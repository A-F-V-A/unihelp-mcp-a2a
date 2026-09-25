import { AsyncLocalStorage } from 'node:async_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { normalizeHeaders } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { FetchLike, Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  type CallToolResult,
  ToolListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import {
  CABECERA_AGENT_ID,
  CABECERA_TRACE_ID,
  type ContextoMcpDto,
  type ErrorHerramientaMcpDto,
  META_MCP,
  PERMISOS_AGENTE,
  RUTA_MCP,
} from '@unihelp/contratos';
import {
  type ContextoInvocacion,
  type DescripcionCapacidad,
  ErrorHerramienta,
  ErrorInfraestructura,
  type PuertoCapacidades,
  type ResultadoInvocacion,
  ahoraMonotonoMs,
  descripcionDesdeHerramientaPublicada,
  esCodigoErrorHerramienta,
} from '@unihelp/herramientas';
import {
  CONFIGURACION_CLIENTE_MCP,
  type ConfiguracionClienteMcp,
} from './configuracion-cliente-mcp';

/** Version con la que el cliente se presenta en `initialize`. */
const VERSION_CLIENTE = '0.1.0';

/**
 * Construye el transporte del cliente. Se inyecta para que las pruebas usen un
 * transporte en memoria; en produccion es Streamable HTTP contra `mcp-server`.
 */
export type FabricaTransporteMcp = (fetchConCabeceras: FetchLike) => Transport;

export const FABRICA_TRANSPORTE_MCP = Symbol('FABRICA_TRANSPORTE_MCP');

/** El servidor MCP no responde o rompio el protocolo: `error_infraestructura`, nunca una respuesta inventada (RM-15). */
export class ErrorInfraestructuraMcp extends ErrorInfraestructura {}

function textoDe(resultado: CallToolResult): string {
  const bloque = resultado.content.find((c) => c.type === 'text');
  return bloque && 'text' in bloque ? bloque.text : '';
}

/**
 * Implementacion MCP del puerto de capacidades. En B1 es la UNICA pieza que no
 * es el nucleo compartido, y la unica diferencia con B0 (H1, RNF-01); en B2 y
 * B3 la usa cada agente (orquestador y especialistas) con su rol (decision 44),
 * asi que B3 - B2 no incluye ninguna diferencia en el acceso a las herramientas.
 *
 * - Descubre las herramientas con `tools/list` la primera vez que el nucleo las
 *   pide y las traduce a la descripcion neutral del puerto; el nucleo las lleva
 *   al formato de function calling en el mismo lugar que en B0.
 * - Con un rol (`agente`), filtra la lista con `PERMISOS_AGENTE`: el modelo de
 *   cada especialista solo ve sus herramientas, y el servidor rechaza igual una
 *   llamada fuera del mapa (docs/03, seccion 5; HU-20).
 * - Ante `notifications/tools/list_changed` olvida la lista: la siguiente
 *   llamada al modelo ya ve las herramientas nuevas, sin reiniciar (HU-27).
 * - Cada `tools/call` viaja con `X-Trace-Id` (HU-33) y, si hay rol, con
 *   `X-Agent-Id` en la cabecera HTTP, y con `conversacionId` y `actor` en
 *   `_meta`; mide la ida y vuelta con reloj monotono y toma la duracion que el
 *   servidor reporta en `_meta`, de modo que `transport_ms = rtt - dur` sin
 *   restar marcas de otro proceso (D5, RM-05).
 * - Si el servidor no responde, lanza `ErrorInfraestructura`: la ejecucion
 *   termina como `error_infraestructura` (RM-15).
 */
@Injectable()
export class CapacidadesMcp implements PuertoCapacidades, OnModuleDestroy {
  private readonly logger: Logger;
  /** Traza de la invocacion en curso; la lee el `fetch` para poner la cabecera. */
  private readonly trazaEnCurso = new AsyncLocalStorage<string>();
  private readonly fabrica: FabricaTransporteMcp;
  private conexion: Promise<Client> | null = null;
  private herramientas: readonly DescripcionCapacidad[] | null = null;

  constructor(
    @Inject(CONFIGURACION_CLIENTE_MCP) private readonly configuracion: ConfiguracionClienteMcp,
    @Optional() @Inject(FABRICA_TRANSPORTE_MCP) fabrica: FabricaTransporteMcp | null,
  ) {
    this.logger = new Logger(
      configuracion.agente === null ? 'CapacidadesMcp' : `CapacidadesMcp:${configuracion.agente}`,
    );
    this.fabrica =
      fabrica ??
      ((fetchConCabeceras) =>
        new StreamableHTTPClientTransport(new URL(RUTA_MCP, `${configuracion.urlServidorMcp}/`), {
          fetch: fetchConCabeceras,
        }));
  }

  /** Rol con el que se presenta ante el servidor, o `null` (B1). */
  get agente(): ConfiguracionClienteMcp['agente'] {
    return this.configuracion.agente;
  }

  async listar(): Promise<readonly DescripcionCapacidad[]> {
    const cliente = await this.conectar();
    if (this.herramientas === null) {
      try {
        const { tools } = await cliente.listTools();
        const permitidas = this.configuracion.agente === null ? null : this.permitidas();
        this.herramientas = tools
          .filter((t) => permitidas === null || permitidas.includes(t.name))
          .map(descripcionDesdeHerramientaPublicada);
        this.logger.log(
          `Herramientas descubiertas por tools/list: ${this.herramientas.map((h) => h.nombre).join(', ')}` +
            (permitidas === null ? '' : ` (de ${tools.length} publicadas; filtro por rol)`),
        );
      } catch (fallo) {
        throw this.comoInfraestructura('descubrir las herramientas (tools/list)', fallo);
      }
    }
    return this.herramientas;
  }

  async invocar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
  ): Promise<ResultadoInvocacion> {
    const cliente = await this.conectar();
    if (typeof argumentos !== 'object' || argumentos === null || Array.isArray(argumentos)) {
      // MCP exige un objeto en `arguments`. En B0 el validador del receptor
      // rechaza esto con el mismo codigo; aqui no hay forma de enviarlo (DP-B1-04).
      return {
        ok: false,
        error: new ErrorHerramienta(
          'VALIDACION_ENTRADA',
          `Argumentos inválidos para ${nombre}: los argumentos debe ser de tipo object.`,
        ),
        durMs: 0,
        rttMs: 0,
      };
    }
    const meta: ContextoMcpDto = { conversacionId: contexto.conversacionId, actor: contexto.actor };

    const inicio = ahoraMonotonoMs();
    let resultado: CallToolResult;
    try {
      resultado = (await this.trazaEnCurso.run(contexto.traceId, () =>
        cliente.callTool({
          name: nombre,
          arguments: argumentos as Record<string, unknown>,
          _meta: { [META_MCP.contexto]: meta },
        }),
      )) as CallToolResult;
    } catch (fallo) {
      throw this.comoInfraestructura(`invocar ${nombre} (tools/call)`, fallo);
    }
    const rttMs = ahoraMonotonoMs() - inicio;

    const metaResultado = (resultado._meta ?? {}) as Record<string, unknown>;
    const reportada = metaResultado[META_MCP.duracionMs];
    const durMs = typeof reportada === 'number' ? reportada : 0;
    if (typeof reportada !== 'number') {
      this.logger.warn(`El servidor no reportó su duración en ${nombre}; transport_ms = rtt.`);
    }

    if (resultado.isError) {
      const error = metaResultado[META_MCP.error] as Partial<ErrorHerramientaMcpDto> | undefined;
      const codigo = esCodigoErrorHerramienta(error?.codigo)
        ? error.codigo
        : 'SERVICIO_NO_DISPONIBLE';
      return {
        ok: false,
        error: new ErrorHerramienta(codigo, error?.mensaje ?? textoDe(resultado)),
        durMs,
        rttMs,
      };
    }
    return {
      ok: true,
      salida: {
        paraModelo: resultado.structuredContent ?? JSON.parse(textoDe(resultado) || 'null'),
        estructurado: metaResultado[META_MCP.estructurado] ?? null,
      },
      durMs,
      rttMs,
    };
  }

  async onModuleDestroy(): Promise<void> {
    const conexion = this.conexion;
    this.conexion = null;
    if (conexion !== null) {
      await (await conexion.catch(() => null))?.close();
    }
  }

  private permitidas(): readonly string[] {
    return this.configuracion.agente === null
      ? []
      : (PERMISOS_AGENTE[this.configuracion.agente] ?? []);
  }

  /** Conecta una vez y reutiliza la sesion; tras un cierre, la siguiente llamada reconecta. */
  private conectar(): Promise<Client> {
    this.conexion ??= this.abrir().catch((fallo: unknown) => {
      this.conexion = null;
      throw fallo;
    });
    return this.conexion;
  }

  private async abrir(): Promise<Client> {
    const cliente = new Client({
      name: this.configuracion.nombreCliente,
      version: VERSION_CLIENTE,
    });
    cliente.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      // Se olvida la lista, no se vuelve a pedir aqui: el nucleo la pide antes
      // de la siguiente llamada al modelo y la usa desde ahi (HU-27).
      this.herramientas = null;
      this.logger.log('El servidor notificó un cambio en la lista de herramientas.');
    });
    cliente.onclose = () => {
      this.conexion = null;
      this.herramientas = null;
    };
    try {
      await cliente.connect(this.fabrica(this.fetchConCabeceras));
    } catch (fallo) {
      throw this.comoInfraestructura(
        `conectar con el servidor MCP en ${this.configuracion.urlServidorMcp}`,
        fallo,
      );
    }
    return cliente;
  }

  /** `fetch` que agrega la traza de la invocacion en curso (HU-33) y el rol del agente (HU-20). */
  private readonly fetchConCabeceras: FetchLike = (url, init) => {
    const cabeceras = normalizeHeaders(init?.headers);
    const traza = this.trazaEnCurso.getStore();
    if (traza !== undefined) {
      cabeceras[CABECERA_TRACE_ID] = traza;
    }
    if (this.configuracion.agente !== null) {
      cabeceras[CABECERA_AGENT_ID] = this.configuracion.agente;
    }
    return fetch(url, { ...init, headers: cabeceras });
  };

  private comoInfraestructura(accion: string, fallo: unknown): ErrorInfraestructuraMcp {
    const detalle = fallo instanceof Error ? fallo.message : String(fallo);
    return new ErrorInfraestructuraMcp(`No se pudo ${accion}: ${detalle}`);
  }
}

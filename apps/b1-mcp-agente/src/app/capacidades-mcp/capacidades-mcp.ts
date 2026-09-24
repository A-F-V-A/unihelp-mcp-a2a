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
  CABECERA_TRACE_ID,
  type ContextoMcpDto,
  type ErrorHerramientaMcpDto,
  META_MCP,
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
import { CONFIGURACION_B1, type ConfiguracionB1 } from './configuracion-b1';

/** Como se presenta B1 en `initialize`. */
const CLIENTE_MCP = { name: 'b1-mcp-agente', version: '0.1.0' } as const;

/**
 * Construye el transporte del cliente. Se inyecta para que las pruebas usen un
 * transporte en memoria; en produccion es Streamable HTTP contra `mcp-server`.
 */
export type FabricaTransporteMcp = (fetchConTraza: FetchLike) => Transport;

export const FABRICA_TRANSPORTE_MCP = Symbol('FABRICA_TRANSPORTE_MCP');

/** El servidor MCP no responde o rompio el protocolo: `error_infraestructura`, nunca una respuesta inventada (RM-15). */
export class ErrorInfraestructuraMcp extends ErrorInfraestructura {}

function textoDe(resultado: CallToolResult): string {
  const bloque = resultado.content.find((c) => c.type === 'text');
  return bloque && 'text' in bloque ? bloque.text : '';
}

/**
 * Implementacion MCP del puerto de capacidades: la UNICA pieza de B1 que no es
 * el nucleo compartido, y la unica diferencia con B0 (H1, RNF-01).
 *
 * - Descubre las herramientas con `tools/list` la primera vez que el nucleo las
 *   pide y las traduce a la descripcion neutral del puerto; el nucleo las lleva
 *   al formato de function calling en el mismo lugar que en B0.
 * - Ante `notifications/tools/list_changed` olvida la lista: la siguiente
 *   llamada al modelo ya ve las herramientas nuevas, sin reiniciar (HU-27).
 * - Cada `tools/call` viaja con `X-Trace-Id` en la cabecera HTTP (HU-33) y con
 *   `conversacionId` y `actor` en `_meta`; mide la ida y vuelta con reloj
 *   monotono y toma la duracion que el servidor reporta en `_meta`, de modo que
 *   `transport_ms = rtt - dur` sin restar marcas de otro proceso (D5, RM-05).
 * - Si el servidor no responde, lanza `ErrorInfraestructura`: la ejecucion
 *   termina como `error_infraestructura` (RM-15).
 */
@Injectable()
export class CapacidadesMcp implements PuertoCapacidades, OnModuleDestroy {
  private readonly logger = new Logger('CapacidadesMcp');
  /** Traza de la invocacion en curso; la lee el `fetch` para poner la cabecera. */
  private readonly trazaEnCurso = new AsyncLocalStorage<string>();
  private readonly fabrica: FabricaTransporteMcp;
  private conexion: Promise<Client> | null = null;
  private herramientas: readonly DescripcionCapacidad[] | null = null;

  constructor(
    @Inject(CONFIGURACION_B1) private readonly configuracion: ConfiguracionB1,
    @Optional() @Inject(FABRICA_TRANSPORTE_MCP) fabrica: FabricaTransporteMcp | null,
  ) {
    this.fabrica =
      fabrica ??
      ((fetchConTraza) =>
        new StreamableHTTPClientTransport(new URL(RUTA_MCP, `${configuracion.urlServidorMcp}/`), {
          fetch: fetchConTraza,
        }));
  }

  async listar(): Promise<readonly DescripcionCapacidad[]> {
    const cliente = await this.conectar();
    if (this.herramientas === null) {
      try {
        const { tools } = await cliente.listTools();
        this.herramientas = tools.map(descripcionDesdeHerramientaPublicada);
        this.logger.log(
          `Herramientas descubiertas por tools/list: ${this.herramientas.map((h) => h.nombre).join(', ')}`,
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

  /** Conecta una vez y reutiliza la sesion; tras un cierre, la siguiente llamada reconecta. */
  private conectar(): Promise<Client> {
    this.conexion ??= this.abrir().catch((fallo: unknown) => {
      this.conexion = null;
      throw fallo;
    });
    return this.conexion;
  }

  private async abrir(): Promise<Client> {
    const cliente = new Client(CLIENTE_MCP);
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
      await cliente.connect(this.fabrica(this.fetchConTraza));
    } catch (fallo) {
      throw this.comoInfraestructura(
        `conectar con el servidor MCP en ${this.configuracion.urlServidorMcp}`,
        fallo,
      );
    }
    return cliente;
  }

  /** `fetch` que agrega la cabecera de traza de la invocacion en curso (HU-33). */
  private readonly fetchConTraza: FetchLike = (url, init) => {
    const cabeceras = normalizeHeaders(init?.headers);
    const traza = this.trazaEnCurso.getStore();
    if (traza !== undefined) {
      cabeceras[CABECERA_TRACE_ID] = traza;
    }
    return fetch(url, { ...init, headers: cabeceras });
  };

  private comoInfraestructura(accion: string, fallo: unknown): ErrorInfraestructuraMcp {
    const detalle = fallo instanceof Error ? fallo.message : String(fallo);
    return new ErrorInfraestructuraMcp(`No se pudo ${accion}: ${detalle}`);
  }
}

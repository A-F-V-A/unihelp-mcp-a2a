import { AsyncLocalStorage } from 'node:async_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { FetchLike, Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { normalizeHeaders } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Inject, Injectable, Logger, type OnModuleDestroy, Optional } from '@nestjs/common';
import type {
  ContextoMcpDto,
  ErrorHerramientaMcpDto,
} from '@unihelp/contratos';
import {
  CABECERA_AGENT_ID,
  CABECERA_TRACE_ID,
  META_MCP,
  RUTA_MCP,
} from '@unihelp/contratos';
import {
  ahoraMonotonoMs,
  ErrorHerramienta,
  ErrorInfraestructura,
  esCodigoErrorHerramienta,
} from '@unihelp/herramientas';
import {
  CONFIGURACION_DIAGNOSTICO,
  type ConfiguracionDiagnostico,
} from './configuracion-diagnostico';

const CLIENTE_MCP = { name: 'b3-a2a-diagnostico', version: '0.1.0' } as const;

export type FabricaTransporteMcp = (fetchConTraza: FetchLike) => Transport;
export const FABRICA_TRANSPORTE_MCP = Symbol('FABRICA_TRANSPORTE_MCP');

export class ErrorInfraestructuraMcp extends ErrorInfraestructura {}

function textoDe(resultado: CallToolResult): string {
  const bloque = resultado.content.find((c) => c.type === 'text');
  return bloque && 'text' in bloque ? bloque.text : '';
}

export interface RespuestaEstadoServicioMcp {
  readonly servicio: string;
  readonly nombre: string;
  readonly estado: 'OPERATIVO' | 'DEGRADADO' | 'FUERA_DE_SERVICIO' | 'MANTENIMIENTO';
  readonly desde: string;
  readonly componentes_afectados: readonly string[];
  readonly alcance: 'ninguno' | 'parcial' | 'total' | 'programado';
  readonly nivel_sla: string;
  readonly mensaje: string | null;
  readonly eta_restablecimiento: string | null;
  readonly ventana_estimada: unknown;
  readonly incidente_ref: string | null;
}

/**
 * Cliente MCP del especialista de diagnostico (HU-20, HU-25, HU-33).
 *
 * Invoca `consultar_estado_servicio` en `mcp-server` pasando la cabecera `X-Agent-Id: diagnostico`
 * para validar privilegios de solo lectura (HU-20) y `X-Trace-Id` para trazabilidad (HU-33).
 */
@Injectable()
export class CapacidadesMcpDiagnostico implements OnModuleDestroy {
  private readonly logger = new Logger('CapacidadesMcpDiagnostico');
  private readonly trazaEnCurso = new AsyncLocalStorage<string>();
  private readonly fabrica: FabricaTransporteMcp;
  private conexion: Promise<Client> | null = null;

  constructor(
    @Inject(CONFIGURACION_DIAGNOSTICO)
    private readonly configuracion: ConfiguracionDiagnostico,
    @Optional() @Inject(FABRICA_TRANSPORTE_MCP) fabrica: FabricaTransporteMcp | null,
  ) {
    this.fabrica =
      fabrica ??
      ((fetchConTraza) =>
        new StreamableHTTPClientTransport(
          new URL(RUTA_MCP, `${configuracion.urlServidorMcp}/`),
          { fetch: fetchConTraza },
        ));
  }

  /**
   * Consulta el estado de un servicio universitario a traves de MCP.
   */
  async consultarEstadoServicio(
    servicio: string,
    traceId = 'trace-b3-diagnostico-local',
  ): Promise<{
    estado: RespuestaEstadoServicioMcp;
    durMs: number;
    rttMs: number;
  }> {
    const cliente = await this.conectar();
    const meta: ContextoMcpDto = { conversacionId: traceId, actor: 'sistema' };

    const inicio = ahoraMonotonoMs();
    let resultado: CallToolResult;
    try {
      resultado = (await this.trazaEnCurso.run(traceId, () =>
        cliente.callTool({
          name: 'consultar_estado_servicio',
          arguments: { servicio },
          _meta: { [META_MCP.contexto]: meta },
        }),
      )) as CallToolResult;
    } catch (fallo) {
      throw this.comoInfraestructura('invocar consultar_estado_servicio (tools/call)', fallo);
    }
    const rttMs = ahoraMonotonoMs() - inicio;

    const metaResultado = (resultado._meta ?? {}) as Record<string, unknown>;
    const reportada = metaResultado[META_MCP.duracionMs];
    const durMs = typeof reportada === 'number' ? reportada : 0;

    if (resultado.isError) {
      const error = metaResultado[META_MCP.error] as Partial<ErrorHerramientaMcpDto> | undefined;
      const codigo = esCodigoErrorHerramienta(error?.codigo)
        ? error.codigo
        : 'SERVICIO_NO_DISPONIBLE';
      throw new ErrorHerramienta(codigo, error?.mensaje ?? textoDe(resultado));
    }

    const estructurado =
      (metaResultado[META_MCP.estructurado] as { paraModelo?: RespuestaEstadoServicioMcp } | undefined)?.paraModelo ??
      (JSON.parse(textoDe(resultado) || '{}') as RespuestaEstadoServicioMcp);

    return {
      estado: estructurado,
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

  private conectar(): Promise<Client> {
    this.conexion ??= this.abrir().catch((fallo: unknown) => {
      this.conexion = null;
      throw fallo;
    });
    return this.conexion;
  }

  private async abrir(): Promise<Client> {
    const cliente = new Client(CLIENTE_MCP);
    cliente.onclose = () => {
      this.conexion = null;
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

  /**
   * `fetch` que agrega las cabeceras `X-Agent-Id: diagnostico` y `X-Trace-Id` (HU-20, HU-33).
   */
  private readonly fetchConTraza: FetchLike = (url, init) => {
    const cabeceras = normalizeHeaders(init?.headers);
    cabeceras[CABECERA_AGENT_ID] = 'diagnostico';
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

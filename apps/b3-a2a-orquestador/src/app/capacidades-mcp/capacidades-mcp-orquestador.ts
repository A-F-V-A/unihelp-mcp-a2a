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
  CONFIGURACION_ORQUESTADOR,
  type ConfiguracionOrquestador,
} from './configuracion-orquestador';

const CLIENTE_MCP = { name: 'b3-a2a-orquestador', version: '0.1.0' } as const;

export type FabricaTransporteMcp = (fetchConTraza: FetchLike) => Transport;
export const FABRICA_TRANSPORTE_MCP = Symbol('FABRICA_TRANSPORTE_MCP');

export class ErrorInfraestructuraMcp extends ErrorInfraestructura {}

function textoDe(resultado: CallToolResult): string {
  const bloque = resultado.content.find((c) => c.type === 'text');
  return bloque && 'text' in bloque ? bloque.text : '';
}

export interface RespuestaProponerTicket {
  readonly proposal_id: string;
  readonly servicio: string;
  readonly categoria: string;
  readonly prioridad: string;
  readonly resumen: string;
  readonly descripcion: string;
  readonly expira_en: string;
}

export interface RespuestaConfirmarPropuesta {
  readonly confirmacion_token: string | null;
  readonly aceptada: boolean;
  readonly motivo_rechazo: string | null;
}

export interface RespuestaCrearTicket {
  readonly ticket_id: string | null;
  readonly estado: string | null;
  readonly creado_en: string | null;
  readonly creado: boolean;
  readonly motivo: string | null;
}

/**
 * Cliente MCP del orquestador B3 para gestion de tickets (HU-13 a HU-17, HU-20).
 *
 * Invoca las herramientas mutables en `mcp-server` pasando la cabecera `X-Agent-Id: orquestador`
 * para validar privilegios de emision (HU-20) y `X-Trace-Id` para trazabilidad (HU-33).
 */
@Injectable()
export class CapacidadesMcpOrquestador implements OnModuleDestroy {
  private readonly logger = new Logger('CapacidadesMcpOrquestador');
  private readonly trazaEnCurso = new AsyncLocalStorage<string>();
  private readonly fabrica: FabricaTransporteMcp;
  private conexion: Promise<Client> | null = null;

  constructor(
    @Inject(CONFIGURACION_ORQUESTADOR)
    private readonly configuracion: ConfiguracionOrquestador,
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
   * Propone un ticket legible antes de crearlo (HU-13).
   */
  async proponerTicket(
    params: {
      servicio: string;
      categoria: string;
      prioridad: string;
      resumen: string;
      descripcion: string;
    },
    traceId = 'trace-orquestador-local',
  ): Promise<{ propuesta: RespuestaProponerTicket; durMs: number; rttMs: number }> {
    const { resultado, durMs, rttMs } = await this.ejecutarHerramienta(
      'proponer_ticket',
      params,
      traceId,
    );
    const propuesta = resultado as RespuestaProponerTicket;
    return { propuesta, durMs, rttMs };
  }

  /**
   * Confirma la propuesta tras la aprobacion explicita del usuario (HU-14, HU-15, HU-16).
   */
  async confirmarPropuesta(
    proposalId: string,
    textoConfirmacion: string,
    traceId = 'trace-orquestador-local',
  ): Promise<{ confirmacion: RespuestaConfirmarPropuesta; durMs: number; rttMs: number }> {
    const { resultado, durMs, rttMs } = await this.ejecutarHerramienta(
      'confirmar_propuesta',
      {
        proposal_id: proposalId,
        texto_confirmacion: textoConfirmacion,
        actor: 'usuario',
      },
      traceId,
    );
    const confirmacion = resultado as RespuestaConfirmarPropuesta;
    return { confirmacion, durMs, rttMs };
  }

  /**
   * Crea el ticket simulado con el token de confirmacion valido (HU-16, HU-17).
   */
  async crearTicketSimulado(
    proposalId: string,
    confirmacionToken: string,
    traceId = 'trace-orquestador-local',
  ): Promise<{ ticket: RespuestaCrearTicket; durMs: number; rttMs: number }> {
    const { resultado, durMs, rttMs } = await this.ejecutarHerramienta(
      'crear_ticket_simulado',
      {
        proposal_id: proposalId,
        confirmacion_token: confirmacionToken,
      },
      traceId,
    );
    const ticket = resultado as RespuestaCrearTicket;
    return { ticket, durMs, rttMs };
  }

  private async ejecutarHerramienta(
    nombre: string,
    argumentos: Record<string, unknown>,
    traceId: string,
  ): Promise<{ resultado: unknown; durMs: number; rttMs: number }> {
    const cliente = await this.conectar();
    const meta: ContextoMcpDto = { conversacionId: traceId, actor: 'sistema' };

    const inicio = ahoraMonotonoMs();
    let callResult: CallToolResult;
    try {
      callResult = (await this.trazaEnCurso.run(traceId, () =>
        cliente.callTool({
          name: nombre,
          arguments: argumentos,
          _meta: { [META_MCP.contexto]: meta },
        }),
      )) as CallToolResult;
    } catch (fallo) {
      throw this.comoInfraestructura(`invocar ${nombre} (tools/call)`, fallo);
    }
    const rttMs = ahoraMonotonoMs() - inicio;

    const metaResultado = (callResult._meta ?? {}) as Record<string, unknown>;
    const reportada = metaResultado[META_MCP.duracionMs];
    const durMs = typeof reportada === 'number' ? reportada : 0;

    if (callResult.isError) {
      const error = metaResultado[META_MCP.error] as Partial<ErrorHerramientaMcpDto> | undefined;
      const codigo = esCodigoErrorHerramienta(error?.codigo)
        ? error.codigo
        : 'SERVICIO_NO_DISPONIBLE';
      throw new ErrorHerramienta(codigo, error?.mensaje ?? textoDe(callResult));
    }

    const estructurado =
      metaResultado[META_MCP.estructurado] ?? JSON.parse(textoDe(callResult) || '{}');

    return { resultado: estructurado, durMs, rttMs };
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
   * `fetch` que agrega las cabeceras `X-Agent-Id: orquestador` y `X-Trace-Id` (HU-20, HU-33).
   */
  private readonly fetchConTraza: FetchLike = (url, init) => {
    const cabeceras = normalizeHeaders(init?.headers);
    cabeceras[CABECERA_AGENT_ID] = 'orquestador';
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

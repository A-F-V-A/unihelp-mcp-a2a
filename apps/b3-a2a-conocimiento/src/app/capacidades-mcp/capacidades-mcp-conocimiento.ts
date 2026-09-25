import { AsyncLocalStorage } from 'node:async_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { FetchLike, Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { normalizeHeaders } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Inject, Injectable, Logger, type OnModuleDestroy, Optional } from '@nestjs/common';
import type {
  ArtefactoPoliticaAplicableDataDto,
  ContextoMcpDto,
  ErrorHerramientaMcpDto,
  PoliticaCitadaDto,
} from '@unihelp/contratos';
import { CABECERA_AGENT_ID, CABECERA_TRACE_ID, META_MCP, RUTA_MCP } from '@unihelp/contratos';
import {
  ahoraMonotonoMs,
  ErrorHerramienta,
  ErrorInfraestructura,
  esCodigoErrorHerramienta,
} from '@unihelp/herramientas';
import {
  CONFIGURACION_CONOCIMIENTO,
  type ConfiguracionConocimiento,
} from './configuracion-conocimiento';

const CLIENTE_MCP = { name: 'b3-a2a-conocimiento', version: '0.1.0' } as const;

export type FabricaTransporteMcp = (fetchConTraza: FetchLike) => Transport;
export const FABRICA_TRANSPORTE_MCP = Symbol('FABRICA_TRANSPORTE_MCP');

export class ErrorInfraestructuraMcp extends ErrorInfraestructura {}

function textoDe(resultado: CallToolResult): string {
  const bloque = resultado.content.find((c) => c.type === 'text');
  return bloque && 'text' in bloque ? bloque.text : '';
}

/**
 * Cliente MCP del especialista de conocimiento (HU-20, HU-25, HU-33).
 *
 * Invoca `buscar_politica` en `mcp-server` pasando la cabecera `X-Agent-Id: conocimiento`
 * para validar privilegios de solo lectura (HU-20) y `X-Trace-Id` para la observabilidad
 * distribuida de extremo a extremo (HU-33, RM-05, RM-06).
 */
@Injectable()
export class CapacidadesMcpConocimiento implements OnModuleDestroy {
  private readonly logger = new Logger('CapacidadesMcpConocimiento');
  private readonly trazaEnCurso = new AsyncLocalStorage<string>();
  private readonly fabrica: FabricaTransporteMcp;
  private conexion: Promise<Client> | null = null;

  constructor(
    @Inject(CONFIGURACION_CONOCIMIENTO)
    private readonly configuracion: ConfiguracionConocimiento,
    @Optional() @Inject(FABRICA_TRANSPORTE_MCP) fabrica: FabricaTransporteMcp | null,
  ) {
    this.fabrica =
      fabrica ??
      ((fetchConTraza) =>
        new StreamableHTTPClientTransport(new URL(RUTA_MCP, `${configuracion.urlServidorMcp}/`), {
          fetch: fetchConTraza,
        }));
  }

  /**
   * Invoca `buscar_politica` en el servidor MCP y estructura el resultado en el
   * formato del artefacto `politica_aplicable` (HU-05, HU-07, HU-30, doc 03 §4.1).
   */
  async buscarPolitica(
    consulta: string,
    traceId = 'trace-b3-conocimiento-local',
  ): Promise<{
    artefacto: ArtefactoPoliticaAplicableDataDto;
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
          name: 'buscar_politica',
          arguments: { consulta },
          _meta: { [META_MCP.contexto]: meta },
        }),
      )) as CallToolResult;
    } catch (fallo) {
      throw this.comoInfraestructura('invocar buscar_politica (tools/call)', fallo);
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

    const metaEstructurado = metaResultado[META_MCP.estructurado] as
      | {
          politicas?: readonly {
            codigo: string;
            titulo: string;
            version: string;
            extracto: { texto?: string } | string;
            relevancia: number;
          }[];
        }
      | undefined;

    let desdeTexto: {
      resultados?: readonly {
        codigo: string;
        titulo: string;
        version: string;
        extracto: string;
        relevancia: number;
      }[];
    } = {};
    try {
      desdeTexto = JSON.parse(textoDe(resultado) || '{}');
    } catch {
      // Ignorar si el texto no es JSON
    }

    let politicas: PoliticaCitadaDto[] = [];
    if (Array.isArray(metaEstructurado?.politicas) && metaEstructurado.politicas.length > 0) {
      politicas = metaEstructurado.politicas.map((p) => ({
        codigo: p.codigo,
        titulo: p.titulo,
        version: p.version,
        extracto: typeof p.extracto === 'string' ? p.extracto : (p.extracto?.texto ?? ''),
        relevancia: p.relevancia,
      }));
    } else if (Array.isArray(desdeTexto?.resultados)) {
      politicas = desdeTexto.resultados.map((r) => ({
        codigo: r.codigo,
        titulo: r.titulo,
        version: r.version,
        extracto: r.extracto,
        relevancia: r.relevancia,
      }));
    }

    const sinResultados = politicas.length === 0;
    const confianza: 'alta' | 'media' | 'baja' = sinResultados
      ? 'baja'
      : politicas[0]?.relevancia >= 0.8
        ? 'alta'
        : 'media';

    const extractoTexto = politicas[0]?.extracto ? ` ${politicas[0].extracto}` : '';
    const resumen = sinResultados
      ? 'No se encontraron políticas institucionales directamente aplicables a la consulta.'
      : `Según la política institucional ${politicas[0].codigo} (${politicas[0].titulo}):${extractoTexto}`;

    return {
      artefacto: {
        politicas,
        resumen,
        confianza,
        sin_resultados: sinResultados,
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
   * `fetch` que agrega las cabeceras `X-Agent-Id: conocimiento` y `X-Trace-Id` (HU-20, HU-33).
   */
  private readonly fetchConTraza: FetchLike = (url, init) => {
    const cabeceras = normalizeHeaders(init?.headers);
    cabeceras[CABECERA_AGENT_ID] = 'conocimiento';
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

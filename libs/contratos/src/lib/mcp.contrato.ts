/**
 * Convenciones de red entre `mcp-server` y los agentes que hablan MCP (B1 hoy,
 * B3 despues). El protocolo MCP fija `tools/list` y `tools/call`; esto es lo
 * que UniHelp agrega ENCIMA del protocolo y que ambos lados deben leer igual:
 * la cabecera de traza y las claves de `_meta`. Viven aqui, y no en una app,
 * porque un agente nunca importa de otra app (regla 2 de AGENTS.md).
 *
 * Las herramientas en si (nombres, esquemas, anotaciones) NO se declaran aqui:
 * su fuente unica es `@unihelp/herramientas` y el servidor las publica tal cual.
 */

/** Ruta del transporte Streamable HTTP del servidor MCP, fuera de `/api` (docs/02). */
export const RUTA_MCP = '/mcp';

/**
 * Cabecera HTTP con el identificador de traza. Es la MISMA que recibe el agente
 * del ejecutor: viaja del ejecutor al agente y del agente al servidor MCP, y el
 * servidor la propaga a la auditoria (HU-33, F-5).
 */
export const CABECERA_TRACE_ID = 'x-trace-id';

/**
 * Claves de `_meta` que UniHelp usa en MCP. El prefijo `unihelp/` evita chocar
 * con las claves reservadas del protocolo (`modelcontextprotocol.io/...`).
 */
export const META_MCP = {
  /** En la peticion `tools/call`: {@link ContextoMcpDto}. */
  contexto: 'unihelp/contexto',
  /**
   * En el resultado: duracion del manejador en el servidor, medida con reloj
   * monotono desde la entrada hasta la salida (D5, D6). El agente calcula
   * `transport_ms = rtt - duracion_ms` sin restar marcas de otro proceso (RM-05).
   */
  duracionMs: 'unihelp/duracion_ms',
  /** En el resultado: el mismo dato sin sanear, para la traza (M3.1) y la respuesta al frontend. */
  estructurado: 'unihelp/estructurado',
  /** En un resultado con `isError`: {@link ErrorHerramientaMcpDto}. */
  error: 'unihelp/error',
} as const;

/** Lo que el agente dice de si mismo en cada `tools/call`, ademas de la traza. */
export interface ContextoMcpDto {
  readonly conversacionId: string;
  /** Actor que queda en la auditoria. Ej.: `b1-agent`. */
  readonly actor: string;
}

/**
 * Error tipado de una herramienta (docs/02, seccion 5). Alimenta
 * `tool_calls[].resultado_status` y M2.6. El mensaje va en español (RM-11).
 */
export interface ErrorHerramientaMcpDto {
  readonly codigo: string;
  readonly mensaje: string;
}

/** Nombre y version con los que el servidor se presenta en `initialize`. */
export const SERVIDOR_MCP = { name: 'unihelp-mcp', version: '1.0.0' } as const;

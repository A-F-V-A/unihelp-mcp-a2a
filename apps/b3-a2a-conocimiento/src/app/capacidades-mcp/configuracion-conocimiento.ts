/**
 * Configuracion del especialista de conocimiento para conectarse al servidor MCP (HU-20, HU-25).
 */
export interface ConfiguracionConocimiento {
  readonly urlServidorMcp: string;
}

export const CONFIGURACION_CONOCIMIENTO = Symbol('CONFIGURACION_CONOCIMIENTO');

/**
 * Lee la URL de `mcp-server` de las variables de entorno o toma `http://localhost:3010` por defecto.
 */
export function leerConfiguracionConocimiento(
  env: NodeJS.ProcessEnv = process.env,
): ConfiguracionConocimiento {
  const url = env['MCP_SERVER_URL']?.trim() || 'http://localhost:3010';
  return {
    urlServidorMcp: url.replace(/\/+$/, ''),
  };
}

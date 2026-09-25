/**
 * Configuracion del orquestador B3 para conectarse al servidor MCP (HU-20, HU-25).
 */
export interface ConfiguracionOrquestador {
  readonly urlServidorMcp: string;
}

export const CONFIGURACION_ORQUESTADOR = Symbol('CONFIGURACION_ORQUESTADOR');

/**
 * Lee la URL de `mcp-server` de las variables de entorno o toma `http://localhost:3010` por defecto.
 */
export function leerConfiguracionOrquestador(
  env: NodeJS.ProcessEnv = process.env,
): ConfiguracionOrquestador {
  const url = env['MCP_SERVER_URL']?.trim() || 'http://localhost:3010';
  return {
    urlServidorMcp: url.replace(/\/+$/, ''),
  };
}

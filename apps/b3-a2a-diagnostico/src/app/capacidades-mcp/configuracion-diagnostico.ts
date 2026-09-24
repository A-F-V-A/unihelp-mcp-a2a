/**
 * Configuracion del especialista de diagnostico para conectarse al servidor MCP (HU-20, HU-25).
 */
export interface ConfiguracionDiagnostico {
  readonly urlServidorMcp: string;
}

export const CONFIGURACION_DIAGNOSTICO = Symbol('CONFIGURACION_DIAGNOSTICO');

/**
 * Lee la URL de `mcp-server` de las variables de entorno o toma `http://localhost:3010` por defecto.
 */
export function leerConfiguracionDiagnostico(
  env: NodeJS.ProcessEnv = process.env,
): ConfiguracionDiagnostico {
  const url = env['MCP_SERVER_URL']?.trim() || 'http://localhost:3010';
  return {
    urlServidorMcp: url.replace(/\/+$/, ''),
  };
}

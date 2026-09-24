/**
 * Lo unico que B1 configura ademas del nucleo compartido: donde esta el servidor
 * MCP. Todo lo demas (modelo, muestreo, limites, casetes) sale de
 * `leerConfiguracionAgente`, identico a B0 (RNF-01). Un valor faltante detiene
 * el arranque.
 */
export interface ConfiguracionB1 {
  /** URL base de `mcp-server`, sin la ruta `/mcp`. Ej.: `http://localhost:3010`. */
  readonly urlServidorMcp: string;
}

export const CONFIGURACION_B1 = Symbol('CONFIGURACION_B1');

export class ConfiguracionB1InvalidaError extends Error {}

export function leerConfiguracionB1(
  entorno: Readonly<Record<string, string | undefined>> = process.env,
): ConfiguracionB1 {
  const crudo = entorno['MCP_SERVER_URL']?.trim();
  if (!crudo) {
    throw new ConfiguracionB1InvalidaError(
      'Falta la variable de entorno MCP_SERVER_URL (URL base del servidor MCP).',
    );
  }
  try {
    new URL(crudo);
  } catch {
    throw new ConfiguracionB1InvalidaError(`MCP_SERVER_URL no es una URL válida: «${crudo}».`);
  }
  return { urlServidorMcp: crudo.replace(/\/+$/, '') };
}

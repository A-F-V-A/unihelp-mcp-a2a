import { LIMITE_LLAMADAS_POR_DEFECTO } from '@unihelp/herramientas';

/**
 * Configuracion del servidor MCP, leida del entorno al arrancar. Un valor
 * invalido hace FALLAR el arranque (mismo criterio que el agente).
 */
export interface ConfiguracionMcp {
  /**
   * Llamadas a herramientas por ejecucion antes de `LIMITE_EXCEDIDO` (RNF-04;
   * docs/02, 5). En B1 el receptor es este servidor, asi que el limite se aplica
   * aqui y no en el agente; debe valer lo mismo que en B0 (RNF-01).
   */
  readonly limiteLlamadas: number;
}

export class ConfiguracionMcpInvalidaError extends Error {}

export function leerConfiguracionMcp(
  entorno: Readonly<Record<string, string | undefined>> = process.env,
): ConfiguracionMcp {
  const crudo = entorno['UNIHELP_LIMITE_LLAMADAS_HERRAMIENTA']?.trim();
  const limiteLlamadas = crudo ? Number(crudo) : LIMITE_LLAMADAS_POR_DEFECTO;
  if (!Number.isFinite(limiteLlamadas) || limiteLlamadas <= 0) {
    throw new ConfiguracionMcpInvalidaError(
      `UNIHELP_LIMITE_LLAMADAS_HERRAMIENTA no es válida: «${crudo}».`,
    );
  }
  return { limiteLlamadas };
}

import type { AgenteMcp } from '@unihelp/contratos';

/**
 * Lo unico que un agente configura ademas del nucleo compartido cuando alcanza
 * las capacidades por MCP: donde esta el servidor y, en B2 y B3, con que rol se
 * presenta. Todo lo demas (modelo, muestreo, limites, casetes) sale de
 * `leerConfiguracionAgente`, identico en las cuatro arquitecturas (RNF-01). Un
 * valor faltante detiene el arranque.
 */
export interface ConfiguracionClienteMcp {
  /** URL base de `mcp-server`, sin la ruta `/mcp`. Ej.: `http://localhost:3010`. */
  readonly urlServidorMcp: string;
  /**
   * Rol con el que el cliente se identifica en `X-Agent-Id` (HU-20). `null` en
   * B1: el agente unico no tiene privilegios por rol y el servidor no restringe.
   */
  readonly agente: AgenteMcp | null;
  /** Nombre con el que el cliente se presenta en `initialize`. */
  readonly nombreCliente: string;
}

export const CONFIGURACION_CLIENTE_MCP = Symbol('CONFIGURACION_CLIENTE_MCP');

export class ConfiguracionClienteMcpInvalidaError extends Error {}

/** Lee `MCP_SERVER_URL` del entorno y la valida como URL. */
export function leerUrlServidorMcp(
  entorno: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const crudo = entorno['MCP_SERVER_URL']?.trim();
  if (!crudo) {
    throw new ConfiguracionClienteMcpInvalidaError(
      'Falta la variable de entorno MCP_SERVER_URL (URL base del servidor MCP).',
    );
  }
  try {
    new URL(crudo);
  } catch {
    throw new ConfiguracionClienteMcpInvalidaError(
      `MCP_SERVER_URL no es una URL válida: «${crudo}».`,
    );
  }
  return crudo.replace(/\/+$/, '');
}

/** Configuracion completa del cliente a partir del entorno y del rol del agente. */
export function leerConfiguracionClienteMcp(
  nombreCliente: string,
  agente: AgenteMcp | null = null,
  entorno: Readonly<Record<string, string | undefined>> = process.env,
): ConfiguracionClienteMcp {
  return { urlServidorMcp: leerUrlServidorMcp(entorno), agente, nombreCliente };
}

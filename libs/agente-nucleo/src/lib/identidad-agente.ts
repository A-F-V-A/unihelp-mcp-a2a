import type { IdentidadServicio } from '@unihelp/contratos';
import type { AlcanceArquitectura, ProtocoloIntegracion } from '@unihelp/dominio';

/**
 * Lo unico que distingue a un agente unico de otro dentro del nucleo compartido:
 * como se llama, por que protocolo alcanza las capacidades y con que actor firma
 * la auditoria. Va a `tool_calls[].agente` y `tool_calls[].transporte` de la
 * traza y al campo `actor` de cada evento de auditoria (docs/01, 4.6).
 */
export interface IdentidadAgente {
  readonly arquitectura: AlcanceArquitectura;
  /** Proyecto Nx que atiende: `b0-directo`, `b1-mcp-agente`. */
  readonly servicio: string;
  /** `directo` en B0, `mcp` en B1. */
  readonly protocolo: ProtocoloIntegracion;
  /** Ej.: `b0-agent`, `b1-agent`. */
  readonly actor: string;
}

export const IDENTIDAD_AGENTE = Symbol('IDENTIDAD_AGENTE');

/** Deriva la identidad del agente de la identidad de salud de la app, sin repetirla. */
export function identidadAgenteDe(identidad: IdentidadServicio): IdentidadAgente {
  return {
    arquitectura: identidad.arquitectura,
    servicio: identidad.servicio,
    protocolo: identidad.protocolo,
    actor: `${identidad.arquitectura.toLowerCase()}-agent`,
  };
}

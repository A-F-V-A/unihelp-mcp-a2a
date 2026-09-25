import type { IdentidadServicio } from '@unihelp/contratos';
import type { AlcanceArquitectura, ProtocoloIntegracion, RolServicio } from '@unihelp/dominio';

/**
 * Lo unico que distingue a un agente de otro dentro del nucleo compartido:
 * como se llama, que rol cumple, por que protocolo alcanza las capacidades y
 * con que actor firma la auditoria. Va a `tool_calls[].agente` y
 * `tool_calls[].transporte` de la traza y al campo `actor` de cada evento de
 * auditoria (docs/01, 4.6).
 */
export interface IdentidadAgente {
  readonly arquitectura: AlcanceArquitectura;
  /** Proyecto Nx que atiende: `b0-directo`, `b1-mcp-agente`, `b3-a2a-orquestador`. */
  readonly servicio: string;
  /** `agente-unico` en B0 y B1; `orquestador` o `especialista` en B2 y B3. */
  readonly rol: RolServicio;
  /**
   * Nombre con el que firma `tool_calls[].agente`. En el agente unico es el
   * servicio (`b0-directo`); en B2 y B3 es el rol del agente (`orquestador`,
   * `conocimiento`, `diagnostico`), el MISMO en ambas para que la equivalencia
   * B2/B3 compare trazas iguales salvo tiempos (docs/03, 7; decision 44).
   */
  readonly agente: string;
  /** `directo` en B0, `mcp` en B1 y en los especialistas, `en-proceso` o `a2a` en el orquestador. */
  readonly protocolo: ProtocoloIntegracion;
  /** Ej.: `b0-agent`, `b1-agent`, `b3-orquestador`, `b2-conocimiento`. */
  readonly actor: string;
}

export const IDENTIDAD_AGENTE = Symbol('IDENTIDAD_AGENTE');

/**
 * Deriva la identidad del agente de la identidad de salud de la app, sin
 * repetirla. Un especialista de B2 comparte la app con el orquestador: por eso
 * el rol del agente se puede fijar aparte de la identidad de salud.
 */
export function identidadAgenteDe(
  identidad: IdentidadServicio,
  agente?: { readonly nombre: string; readonly protocolo?: ProtocoloIntegracion },
): IdentidadAgente {
  const arquitectura = identidad.arquitectura.toLowerCase();
  if (identidad.rol === 'agente-unico') {
    return {
      arquitectura: identidad.arquitectura,
      servicio: identidad.servicio,
      rol: identidad.rol,
      agente: identidad.servicio,
      protocolo: identidad.protocolo,
      actor: `${arquitectura}-agent`,
    };
  }
  const nombre = agente?.nombre ?? identidad.rol;
  return {
    arquitectura: identidad.arquitectura,
    servicio: identidad.servicio,
    rol: nombre === 'orquestador' ? 'orquestador' : 'especialista',
    agente: nombre,
    protocolo: agente?.protocolo ?? identidad.protocolo,
    actor: `${arquitectura}-${nombre}`,
  };
}

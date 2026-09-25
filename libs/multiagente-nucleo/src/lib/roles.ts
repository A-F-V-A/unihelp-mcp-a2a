import type { AgenteMcp, ArtefactoA2a, HabilidadA2a } from '@unihelp/contratos';

/**
 * Los tres agentes del sistema multiagente (B2 y B3): el orquestador y los dos
 * especialistas. Son los mismos identificadores que `X-Agent-Id` ante el servidor
 * MCP (`AGENTES_MCP`), el `agente` que firma cada `tool_calls[]` de la traza y
 * el `actor` de la auditoria (`b2-conocimiento`, `b3-orquestador`).
 */
export type RolMultiagente = AgenteMcp;

export type RolEspecialista = Exclude<RolMultiagente, 'orquestador'>;

export const ROLES_ESPECIALISTA: readonly RolEspecialista[] = ['conocimiento', 'diagnostico'];

/** Que especialista atiende cada habilidad (docs/03, 2.1 y 2.2). */
export const ESPECIALISTA_DE_HABILIDAD: Readonly<Record<HabilidadA2a, RolEspecialista>> = {
  knowledge_lookup: 'conocimiento',
  incident_diagnosis: 'diagnostico',
};

export const HABILIDAD_DE_ESPECIALISTA: Readonly<Record<RolEspecialista, HabilidadA2a>> = {
  conocimiento: 'knowledge_lookup',
  diagnostico: 'incident_diagnosis',
};

/** Artefacto que devuelve cada habilidad (docs/03, 4.1 y 4.2). */
export const ARTEFACTO_DE_HABILIDAD: Readonly<Record<HabilidadA2a, ArtefactoA2a>> = {
  knowledge_lookup: 'politica_aplicable',
  incident_diagnosis: 'diagnostico',
};

export function esRolEspecialista(valor: unknown): valor is RolEspecialista {
  return typeof valor === 'string' && (ROLES_ESPECIALISTA as readonly string[]).includes(valor);
}

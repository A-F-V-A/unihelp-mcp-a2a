import type { NivelEstadoServicio, Prioridad } from '@unihelp/dominio';

/**
 * Escala de prioridad de la tabla institucional (docs/01, F-3) y de las 40
 * tareas (`esperado.ticket.prioridad`). Es la que escribe el modelo en
 * `proponer_ticket`.
 */
export const CODIGOS_PRIORIDAD = ['P1', 'P2', 'P3', 'P4'] as const;

export type CodigoPrioridad = (typeof CODIGOS_PRIORIDAD)[number];

/**
 * Equivalencia con `PRIORIDADES` de `@unihelp/dominio`, que es lo que muestra
 * el frontend. Provisional mientras no se resuelva DP-03 de
 * `apps/b0-directo/docs/ARQUITECTURA.md`.
 */
export const PRIORIDAD_DOMINIO: Readonly<Record<CodigoPrioridad, Prioridad>> = {
  P1: 'critica',
  P2: 'alta',
  P3: 'media',
  P4: 'baja',
};

/** Nivel de servicio comprometido; los mismos valores que `NIVELES_SERVICIO` de `@unihelp/conocimiento`. */
export type NivelServicioTicket = 'critico' | 'alto' | 'medio';

/**
 * A quien afecta la incidencia. `total`, `parcial` y `programado` los publica el
 * servicio; `individual` no: es la conclusion de que el problema es de la persona.
 */
export type AlcanceTicket = 'total' | 'parcial' | 'programado' | 'individual';

/** Lo que la tabla necesita saber del servicio. Lo aporta quien invoca, desde la base de conocimiento. */
export interface ContextoServicio {
  readonly servicioCodigo: string;
  readonly estado: NivelEstadoServicio;
  /** `null` si el servicio no publica afectacion (operativo). */
  readonly alcance: 'total' | 'parcial' | 'programado' | null;
  readonly nivelServicio: NivelServicioTicket;
}

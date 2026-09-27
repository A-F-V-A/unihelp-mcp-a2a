/**
 * Contrato de la REVISION HUMANA del juez (M7.4, M7.5; docs/04, capa 3;
 * decision 56). La sirve la consola del experimento (`apps/consola-experimento`)
 * y la usa el panel web en `/experimento/revision`.
 *
 * Dos revisores (A y B) califican a ciegas la misma muestra estratificada con la
 * misma rubrica del juez: sin arquitectura, modelo, corrida ni veredicto del juez.
 * Cada revisor solo ve y escribe sus propias calificaciones. Los desacuerdos se
 * resuelven despues en una sesion conjunta (adjudicacion).
 *
 * El veredicto no se elige a mano: sale de la rubrica. `aprobado` solo si todos
 * los puntos clave estan cubiertos y ninguna prohibicion violada; el servidor
 * rechaza una calificacion cuyo veredicto no coincida con sus marcas.
 *
 * Las rutas viven fuera del prefijo `/api`, como el resto de la consola.
 */

export const RUTAS_REVISION = {
  /** `GET` -> {@link MuestraRevisionDto}. La muestra ciega completa. */
  muestra: '/revision/muestra',
  /** `GET` -> {@link ProgresoRevisorDto}. Lo que ya califico ese rol (A o B). */
  progreso: (rol: RolRevisor) => `/revision/revisores/${encodeURIComponent(rol)}`,
  /** `POST` {@link NuevaCalificacionDto} -> {@link CalificacionDto}. Guarda o reemplaza. */
  calificaciones: '/revision/calificaciones',
  /** `GET` -> {@link EstadoAdjudicacionDto}. Solo cuando A y B terminaron. */
  adjudicacion: '/revision/adjudicacion',
  /** `POST` {@link NuevaAdjudicacionDto} -> {@link AdjudicacionDto}. */
  adjudicaciones: '/revision/adjudicaciones',
} as const;

export const ROLES_REVISOR = ['A', 'B'] as const;

export type RolRevisor = (typeof ROLES_REVISOR)[number];

export const VEREDICTOS_REVISION = ['aprobado', 'reprobado'] as const;

export type VeredictoRevision = (typeof VEREDICTOS_REVISION)[number];

/** Un turno de la conversacion calificada. */
export interface TurnoRevisionDto {
  readonly rol: 'usuario' | 'agente';
  readonly texto: string;
}

/** Lo que devolvio una herramienta en esa ejecucion (sin identificadores de la corrida). */
export interface InformacionRecuperadaDto {
  readonly herramienta: string;
  readonly resultado: unknown;
}

/** Una ejecucion de la muestra, ciega. `id` es `R-001`..`R-160`. */
export interface ItemRevisionDto {
  readonly id: string;
  readonly tarea: string;
  readonly dialogo: readonly TurnoRevisionDto[];
  readonly respuestaFinal: string | null;
  /** Puntos clave de la tarea, en orden (se califican por numero, desde 1). */
  readonly puntosClave: readonly string[];
  readonly prohibiciones: readonly string[];
  readonly informacionRecuperada: readonly InformacionRecuperadaDto[];
}

export interface MuestraRevisionDto {
  /** Identificador de la muestra (semilla y tamaño), para la procedencia. */
  readonly version: string;
  readonly items: readonly ItemRevisionDto[];
}

export interface NuevaCalificacionDto {
  readonly rol: RolRevisor;
  /** Nombre de quien califica; un rol pertenece a una sola persona. */
  readonly revisor: string;
  readonly itemId: string;
  /** Numeros (desde 1) de los puntos clave cubiertos. */
  readonly puntosCubiertos: readonly number[];
  /** Numeros (desde 1) de las prohibiciones violadas. */
  readonly prohibicionesVioladas: readonly number[];
  /** Debe coincidir con la rubrica aplicada a las marcas. */
  readonly veredicto: VeredictoRevision;
  readonly comentario: string | null;
}

export interface CalificacionDto extends NuevaCalificacionDto {
  /** ISO 8601 de cuando se guardo. */
  readonly guardadaEn: string;
}

export interface ProgresoRevisorDto {
  readonly rol: RolRevisor;
  /** `null` si nadie ha tomado el rol todavia. */
  readonly revisor: string | null;
  readonly total: number;
  readonly calificaciones: readonly CalificacionDto[];
}

/** Un desacuerdo entre A y B, con las marcas de ambos (la sesion conjunta si las ve). */
export interface DesacuerdoDto {
  readonly item: ItemRevisionDto;
  readonly revisorA: CalificacionDto;
  readonly revisorB: CalificacionDto;
  readonly adjudicado: VeredictoRevision | null;
}

export interface EstadoAdjudicacionDto {
  /** `false` mientras A o B no hayan calificado toda la muestra. */
  readonly disponible: boolean;
  readonly calificadasA: number;
  readonly calificadasB: number;
  readonly total: number;
  readonly acuerdos: number;
  readonly desacuerdos: readonly DesacuerdoDto[];
}

export interface NuevaAdjudicacionDto {
  readonly itemId: string;
  readonly veredicto: VeredictoRevision;
  /** Por que se resolvio asi: queda como precedente de la rubrica (docs/04). */
  readonly motivo: string;
}

export interface AdjudicacionDto extends NuevaAdjudicacionDto {
  readonly guardadaEn: string;
}

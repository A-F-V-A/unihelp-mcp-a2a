import type { RolRevisor, VeredictoRevision } from '@unihelp/contratos';

export { ROLES_REVISOR } from '@unihelp/contratos';
export type { RolRevisor, VeredictoRevision };

export interface TurnoRevision {
  readonly rol: 'usuario' | 'agente';
  readonly texto: string;
}

export interface InformacionRecuperada {
  readonly herramienta: string;
  /** Resultado de la herramienta tal cual; la vista lo muestra como JSON legible. */
  readonly resultado: unknown;
}

/** Una ejecucion de la muestra, sin nada que delate arquitectura, modelo ni veredicto del juez. */
export interface ItemRevision {
  readonly id: string;
  readonly tarea: string;
  readonly dialogo: readonly TurnoRevision[];
  readonly respuestaFinal: string | null;
  readonly puntosClave: readonly string[];
  readonly prohibiciones: readonly string[];
  readonly informacionRecuperada: readonly InformacionRecuperada[];
}

export interface MuestraRevision {
  readonly version: string;
  readonly items: readonly ItemRevision[];
}

/** Lo que marca una persona sobre un item. Los numeros empiezan en 1. */
export interface MarcasRevision {
  readonly puntosCubiertos: readonly number[];
  readonly prohibicionesVioladas: readonly number[];
}

export interface Calificacion extends MarcasRevision {
  readonly rol: RolRevisor;
  readonly revisor: string;
  readonly itemId: string;
  readonly veredicto: VeredictoRevision;
  readonly comentario: string | null;
  readonly guardadaEn: Date;
}

export interface ProgresoRevisor {
  readonly rol: RolRevisor;
  readonly revisor: string | null;
  readonly total: number;
  readonly calificaciones: readonly Calificacion[];
}

export interface Desacuerdo {
  readonly item: ItemRevision;
  readonly revisorA: Calificacion;
  readonly revisorB: Calificacion;
  readonly adjudicado: VeredictoRevision | null;
}

export interface EstadoAdjudicacion {
  readonly disponible: boolean;
  readonly calificadasA: number;
  readonly calificadasB: number;
  readonly total: number;
  readonly acuerdos: number;
  readonly desacuerdos: readonly Desacuerdo[];
}

export interface Adjudicacion {
  readonly itemId: string;
  readonly veredicto: VeredictoRevision;
  readonly motivo: string;
  readonly guardadaEn: Date;
}

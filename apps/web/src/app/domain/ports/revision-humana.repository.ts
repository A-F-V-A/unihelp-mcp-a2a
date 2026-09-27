import type {
  Adjudicacion,
  Calificacion,
  EstadoAdjudicacion,
  MarcasRevision,
  MuestraRevision,
  ProgresoRevisor,
  RolRevisor,
  VeredictoRevision,
} from '../models/experimento/revision-humana';

/**
 * Puerto de la revision humana del juez (M7.4, M7.5; decision 56), servida por
 * la consola del experimento. Rechaza solo con `ErrorBackend`: `sin-conexion`
 * si la consola no esta levantada, `conflicto` si el rol ya lo tomo otra persona
 * y `validacion` si las marcas no cumplen la rubrica.
 */
export interface RevisionHumanaRepository {
  /** La muestra ciega completa: nunca trae arquitectura, modelo ni veredicto del juez. */
  muestra(): Promise<MuestraRevision>;
  /** Solo las calificaciones de ese rol: un revisor nunca ve las del otro. */
  progreso(rol: RolRevisor): Promise<ProgresoRevisor>;
  /** Guarda (o reemplaza) la calificacion de un item. */
  calificar(
    rol: RolRevisor,
    revisor: string,
    itemId: string,
    marcas: MarcasRevision,
    veredicto: VeredictoRevision,
    comentario: string | null,
  ): Promise<Calificacion>;
  /** Desacuerdos entre A y B; `disponible` es falso hasta que ambos terminan. */
  adjudicacion(): Promise<EstadoAdjudicacion>;
  /** Resuelve un desacuerdo en la sesion conjunta, con su motivo como precedente. */
  adjudicar(itemId: string, veredicto: VeredictoRevision, motivo: string): Promise<Adjudicacion>;
}

import type { AreaServicio, NivelServicio } from '@unihelp/dominio';

/** Ver nota de `estado-servicio.ts`: el vocabulario vive en `@unihelp/dominio` (decision 33). */
export { NIVELES_SERVICIO } from '@unihelp/dominio';
export type { NivelServicio } from '@unihelp/dominio';

/**
 * Servicio digital concreto: nodo raiz del grafo de conocimiento (HU-09, HU-10).
 * Agrupa componentes y es el alcance al que aplican las politicas.
 */
export interface Servicio {
  /** Codigo estable en snake_case, el mismo del esquema de `buscar_politica` (docs/02). Ej.: `aula_virtual`. */
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string;
  /** Dependencia que opera el servicio. Ej.: `Oficina de Tecnologias de la Informacion`. */
  readonly unidadResponsable: string;
  /** Area del vocabulario compartido a la que pertenece el servicio. */
  readonly area: AreaServicio;
  readonly nivelServicio: NivelServicio;
}

/**
 * Un trabajo de la consola del experimento (`apps/consola-experimento`): una
 * corrida del ejecutor o una ejecucion del cuaderno, lanzada desde el panel y
 * seguida linea a linea (decision 39). El panel muestra la salida tal cual;
 * lo unico que interpreta es el renglon de progreso que escribe el ejecutor.
 */

export type TipoTrabajo = 'corrida' | 'analisis';

export type EstadoTrabajo = 'en_marcha' | 'terminado' | 'fallido' | 'cancelado';

export interface LineaTrabajo {
  readonly numero: number;
  readonly origen: 'stdout' | 'stderr';
  readonly texto: string;
  readonly en: Date;
}

export interface Trabajo {
  readonly id: string;
  readonly tipo: TipoTrabajo;
  readonly estado: EstadoTrabajo;
  readonly comando: string;
  /** Nombre del directorio de la corrida lanzada o analizada; `null` hasta que el ejecutor lo anuncia. */
  readonly corrida: string | null;
  readonly iniciadoEn: Date;
  readonly terminadoEn: Date | null;
  readonly codigoSalida: number | null;
  readonly lineas: readonly LineaTrabajo[];
}

export interface EstadoConsola {
  readonly trabajo: Trabajo | null;
  readonly ejecutable: string;
  readonly directorioExperimento: string;
}

export type EventoTrabajo =
  | { readonly tipo: 'linea'; readonly linea: LineaTrabajo }
  | { readonly tipo: 'fin'; readonly trabajo: Trabajo };

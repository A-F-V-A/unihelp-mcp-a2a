import type { NivelEstadoServicio } from '@unihelp/dominio';

/**
 * Intervalo publicado para el restablecimiento o la duracion de un mantenimiento.
 *
 * Los instantes viajan como texto ISO 8601 en UTC con precision de segundos
 * (`2026-10-14T13:00:00Z`) y no como `Date`: asi la huella del estado y las
 * comparaciones no dependen de la zona horaria del proceso (decision 17).
 */
export interface VentanaEstimada {
  readonly inicio: string;
  readonly fin: string;
}

/**
 * Pieza de un servicio con estado operativo propio. En la semilla cada componente
 * pertenece a un solo servicio: si el inicio de sesion fuera tambien del aula
 * virtual, una caida de autenticacion apareceria como caida del aula (T-DIA-009).
 */
export interface Componente {
  /** Codigo estable en snake_case. Ej.: `carga_de_archivos`. */
  readonly codigo: string;
  readonly nombre: string;
  /** Vocabulario compartido de `@unihelp/dominio`: operativo, degradado, interrumpido o mantenimiento. */
  readonly estado: NivelEstadoServicio;
  /** `null` cuando el servicio no publico una ventana: nunca se estima (HU-10). */
  readonly ventanaEstimada: VentanaEstimada | null;
  /** Referencia del incidente o del mantenimiento. Ej.: `INC-2026-0042`. */
  readonly incidenteRef: string | null;
  /** ISO 8601 en UTC, precision de segundos. */
  readonly actualizadoEn: string;
}

import type { AreaServicio, NivelEstadoServicio } from '@unihelp/dominio';

/** Intervalo en el que se espera la recuperacion o dura un mantenimiento. */
export interface VentanaEstimadaDto {
  /** ISO 8601. */
  readonly inicio: string;
  /** ISO 8601. */
  readonly fin: string;
}

/** Estado de un servicio: `GET /api/servicios/:servicio/estado` (HU-09, HU-10, HU-12). */
export interface EstadoServicioDto {
  readonly servicio: AreaServicio;
  /** Nombre visible del servicio concreto. Ej.: `Aula virtual (Moodle)`. */
  readonly nombre: string;
  readonly estado: NivelEstadoServicio;
  /** Componente afectado, o `null` si no hay afectacion identificada. */
  readonly componenteAfectado: string | null;
  /** A quien afecta. Ej.: `Estudiantes de pregrado con entregas activas`. */
  readonly alcance: string | null;
  /** `null` cuando todavia no hay estimacion: la UI debe decirlo explicitamente. */
  readonly ventanaEstimada: VentanaEstimadaDto | null;
  /** Incidente masivo al que esta asociado el estado, si existe. */
  readonly incidenteId: string | null;
  /** ISO 8601. */
  readonly actualizadoEn: string;
}

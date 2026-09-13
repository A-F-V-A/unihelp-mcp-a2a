import type { AreaServicio, NivelEstadoServicio } from '@unihelp/dominio';

export interface VentanaEstimada {
  readonly inicio: Date;
  readonly fin: Date;
}

/** Estado de un servicio con su afectacion y ventana estimada. */
export interface EstadoServicio {
  readonly servicio: AreaServicio;
  readonly nombre: string;
  readonly estado: NivelEstadoServicio;
  readonly componenteAfectado: string | null;
  readonly alcance: string | null;
  /** `null` significa "sin estimacion todavia", no "sin afectacion". */
  readonly ventanaEstimada: VentanaEstimada | null;
  readonly incidenteId: string | null;
  readonly actualizadoEn: Date;
}

import type { NivelEstadoServicio } from '@unihelp/dominio';
import type { VentanaEstimada } from './componente';

/**
 * A quien afecta una incidencia (docs/10, seccion 4). `programado` es el alcance
 * de un mantenimiento; `individual` no existe aqui porque no es un estado que el
 * servicio publique sino una conclusion del diagnostico.
 */
export const ALCANCES_AFECTACION = ['total', 'parcial', 'programado'] as const;

export type AlcanceAfectacion = (typeof ALCANCES_AFECTACION)[number];

/** Estado publicado de un servicio completo, con su comunicado (HU-09, HU-10). */
export interface EstadoServicio {
  readonly servicioCodigo: string;
  readonly estado: NivelEstadoServicio;
  /** `null` si el servicio esta operativo. */
  readonly alcance: AlcanceAfectacion | null;
  /**
   * Comunicado para la comunidad. Es contenido RECUPERADO: puede traer texto que
   * aparenta ser una instruccion (T-ADV-007) y nunca debe tratarse como orden.
   */
  readonly mensaje: string | null;
  readonly ventanaEstimada: VentanaEstimada | null;
  readonly incidenteRef: string | null;
  /** Inicio del estado actual. ISO 8601 UTC. */
  readonly desde: string;
}

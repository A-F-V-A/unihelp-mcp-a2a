import type { AlcanceAfectacion, NivelEstadoServicio } from '@unihelp/dominio';
import type { VentanaEstimada } from './componente';

/**
 * El vocabulario vive en `@unihelp/dominio` porque tambien viaja por red: el
 * simulador de sistemas lo publica y `libs/contratos` lo declara (decision 33).
 * Se reexporta aqui para no romper a quien ya lo importaba de esta libreria.
 */
export { ALCANCES_AFECTACION } from '@unihelp/dominio';
export type { AlcanceAfectacion } from '@unihelp/dominio';

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

import type { AreaServicio } from '@unihelp/dominio';
import type { EstadoServicio } from '../models/servicio';

/** Puerto de estado de servicios (HU-09, HU-10, HU-12). */
export interface ServicioRepository {
  consultarEstado(servicio: AreaServicio): Promise<EstadoServicio>;
}

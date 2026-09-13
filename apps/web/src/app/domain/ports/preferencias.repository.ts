import type { Preferencias } from '../models/preferencias';

/**
 * Donde se guardan las preferencias del solicitante. Hoy vive en el navegador;
 * cuando exista un perfil en el backend basta con otra implementacion.
 */
export interface PreferenciasRepository {
  cargar(): Promise<Preferencias>;
  guardar(preferencias: Preferencias): Promise<void>;
}

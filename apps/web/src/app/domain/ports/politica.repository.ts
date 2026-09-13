import type { ConsultaPolitica, Politica } from '../models/politica';

/** Puerto de consulta de politicas institucionales (HU-05, HU-06). */
export interface PoliticaRepository {
  /** Rechaza con `no-encontrado` si el codigo o la version no existen. */
  buscarPolitica(consulta: ConsultaPolitica): Promise<Politica>;
}

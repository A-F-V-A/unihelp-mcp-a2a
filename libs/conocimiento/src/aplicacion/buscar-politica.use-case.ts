import { Inject, Injectable } from '@nestjs/common';
import { MAXIMO_POLITICAS_POR_RESPUESTA } from '@unihelp/dominio';
import type { ConsultaPoliticas, ResultadoBusquedaPoliticas } from '../dominio/busqueda';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { normalizarConsultaPoliticas } from '../dominio/reglas/consulta.rules';
import type { ConfiguracionConocimiento } from './configuracion';
import { CONFIGURACION_CONOCIMIENTO, CONOCIMIENTO_REPOSITORY } from './tokens';

/**
 * Busca hasta tres politicas vigentes por relevancia lexica (HU-05 a HU-08).
 * Si ninguna alcanza el umbral lo declara con un motivo; NUNCA devuelve la mas
 * parecida como sustituto (HU-07).
 */
@Injectable()
export class BuscarPoliticaUseCase {
  constructor(
    @Inject(CONOCIMIENTO_REPOSITORY) private readonly conocimiento: ConocimientoRepository,
    @Inject(CONFIGURACION_CONOCIMIENTO) private readonly configuracion: ConfiguracionConocimiento,
  ) {}

  /** @throws ConsultaInvalidaError si el texto no cumple `LONGITUD_CONSULTA_POLITICAS`. */
  async ejecutar(consulta: ConsultaPoliticas): Promise<ResultadoBusquedaPoliticas> {
    const umbral = this.configuracion.umbralRelevancia;
    const candidatos = await this.conocimiento.buscarPoliticasVigentes({
      ...normalizarConsultaPoliticas(consulta),
      umbral,
      limite: MAXIMO_POLITICAS_POR_RESPUESTA,
    });
    const base = { consultaNormalizada: candidatos.consultaNormalizada, umbral };

    if (candidatos.terminos === 0) {
      return { tipo: 'sin-resultados', motivo: 'consulta-sin-terminos', ...base };
    }
    if (candidatos.coincidencias === 0) {
      return { tipo: 'sin-resultados', motivo: 'sin-coincidencias', ...base };
    }
    if (candidatos.politicas.length === 0) {
      return { tipo: 'sin-resultados', motivo: 'bajo-umbral', ...base };
    }
    return { tipo: 'encontradas', politicas: candidatos.politicas, ...base };
  }
}

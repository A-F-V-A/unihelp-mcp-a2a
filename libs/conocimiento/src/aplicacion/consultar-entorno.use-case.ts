import { Inject, Injectable } from '@nestjs/common';
import type { EntornoConocimiento } from '../dominio/grafo';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { CONOCIMIENTO_REPOSITORY } from './tokens';

/**
 * Que variante esta cargada en la base ahora mismo: version de semilla, estado
 * inicial y corpus (la fila `entorno`).
 *
 * Lee el grafo completo porque el puerto no ofrece una lectura mas fina. Por eso
 * es para arranque, diagnostico y para el simulador de sistemas, NUNCA para el
 * camino que se mide: una llamada aqui dentro de una ejecucion inflaria
 * `tool_exec_ms` sin que la arquitectura lo justifique.
 */
@Injectable()
export class ConsultarEntornoUseCase {
  constructor(
    @Inject(CONOCIMIENTO_REPOSITORY) private readonly conocimiento: ConocimientoRepository,
  ) {}

  async ejecutar(): Promise<EntornoConocimiento> {
    return (await this.conocimiento.leerEstado()).entorno;
  }
}

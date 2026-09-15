import { Inject, Injectable } from '@nestjs/common';
import { CategoriaNoEncontradaError } from '../dominio/errores';
import type { PoliticasDeCategoria } from '../dominio/grafo';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { CONOCIMIENTO_REPOSITORY } from './tokens';

/** Recorre categoria -> politicas y devuelve la version vigente de cada una (HU-09, HU-10). */
@Injectable()
export class ConsultarPoliticasDeCategoriaUseCase {
  constructor(
    @Inject(CONOCIMIENTO_REPOSITORY) private readonly conocimiento: ConocimientoRepository,
  ) {}

  /** @throws CategoriaNoEncontradaError si el codigo no existe. */
  async ejecutar(categoriaCodigo: string): Promise<PoliticasDeCategoria> {
    const resultado = await this.conocimiento.obtenerPoliticasDeCategoria(categoriaCodigo.trim());
    if (resultado === null) {
      throw new CategoriaNoEncontradaError(categoriaCodigo);
    }
    return resultado;
  }
}

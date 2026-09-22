import { Inject, Injectable } from '@nestjs/common';
import { PoliticaNoEncontradaError } from '../dominio/errores';
import type { Extracto, Politica, VersionPolitica } from '../dominio/politica';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { compararTexto } from '../dominio/reglas/estado-canonico.rules';
import { CONOCIMIENTO_REPOSITORY } from './tokens';

/** Una version concreta de una politica, con sus extractos y los servicios a los que aplica. */
export interface PoliticaCompleta {
  readonly politica: Politica;
  readonly version: VersionPolitica;
  /** Ordenados por ordinal. */
  readonly extractos: readonly Extracto[];
  /** Codigos de servicio, en orden binario. */
  readonly servicios: readonly string[];
}

/**
 * Devuelve una politica por codigo, en la version pedida o en la vigente, para
 * que la persona pueda leerla completa despues de verla citada (HU-05). No
 * busca por relevancia: eso es de `BuscarPoliticaUseCase`.
 */
@Injectable()
export class ObtenerPoliticaUseCase {
  constructor(
    @Inject(CONOCIMIENTO_REPOSITORY) private readonly conocimiento: ConocimientoRepository,
  ) {}

  /** @throws PoliticaNoEncontradaError si no existe la politica o la version pedida. */
  async ejecutar(codigo: string, version: string | null = null): Promise<PoliticaCompleta> {
    const estado = await this.conocimiento.leerEstado();
    const politica = estado.politicas.find((p) => p.codigo === codigo);
    if (politica === undefined) {
      throw new PoliticaNoEncontradaError(codigo, null);
    }
    // Sin version explicita se toma la marcada como vigente, nunca la mas reciente por fecha (HU-08).
    const elegida = estado.versiones.find(
      (v) => v.politicaCodigo === codigo && (version === null ? v.vigente : v.version === version),
    );
    if (elegida === undefined) {
      throw new PoliticaNoEncontradaError(codigo, version);
    }
    return {
      politica,
      version: elegida,
      extractos: estado.extractos
        .filter((e) => e.politicaCodigo === codigo && e.version === elegida.version)
        .sort((a, b) => a.ordinal - b.ordinal),
      servicios: estado.politicasServicios
        .filter((a) => a.politicaCodigo === codigo)
        .map((a) => a.servicioCodigo)
        .sort(compararTexto),
    };
  }
}

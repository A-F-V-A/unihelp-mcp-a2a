import { Inject, Injectable } from '@nestjs/common';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { contarFilas } from '../dominio/reglas/estado-canonico.rules';
import { construirEstadoConocimiento } from '../dominio/reglas/semilla.rules';
import type { SemillaConocimiento } from '../dominio/semilla';
import { calcularHuella } from './huella';
import type { ResultadoRestablecimiento } from './restablecer-conocimiento.use-case';
import { CONOCIMIENTO_REPOSITORY, SEMILLA_CONOCIMIENTO } from './tokens';

export interface ResultadoSiembra extends ResultadoRestablecimiento {
  /** `sembrada` si la base estaba vacia; `sin-cambios` si ya tenia exactamente la semilla. */
  readonly accion: 'sembrada' | 'sin-cambios';
}

/**
 * Carga la semilla base (`todo_operativo`, corpus `estandar`) en una base vacia.
 * Es idempotente y no destructiva: correrla otra vez no cambia nada, y si
 * encuentra datos distintos falla en vez de sobrescribirlos. Por eso no exige
 * perfil, a diferencia del restablecimiento.
 */
@Injectable()
export class SembrarConocimientoUseCase {
  constructor(
    @Inject(CONOCIMIENTO_REPOSITORY) private readonly conocimiento: ConocimientoRepository,
    @Inject(SEMILLA_CONOCIMIENTO) private readonly semilla: SemillaConocimiento,
  ) {}

  /** @throws EstadoInconsistenteError si la base tiene datos distintos a la semilla base. */
  async ejecutar(): Promise<ResultadoSiembra> {
    const { accion, estado } = await this.conocimiento.sembrarSiVacia(
      construirEstadoConocimiento(this.semilla),
    );
    return {
      accion,
      huella: calcularHuella(estado),
      versionSemilla: estado.entorno.versionSemilla,
      estadoInicial: estado.entorno.estadoInicial,
      corpus: estado.entorno.corpus,
      conteos: contarFilas(estado),
    };
  }
}

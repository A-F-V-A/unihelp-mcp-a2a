import { Inject, Injectable } from '@nestjs/common';
import { RestablecimientoNoPermitidoError } from '../dominio/errores';
import type { ConteosConocimiento, CorpusConocimiento } from '../dominio/grafo';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { construirEstadoConocimiento } from '../dominio/reglas/semilla.rules';
import { contarFilas } from '../dominio/reglas/estado-canonico.rules';
import type { SeleccionEstado, SemillaConocimiento } from '../dominio/semilla';
import type { ConfiguracionConocimiento } from './configuracion';
import { calcularHuella } from './huella';
import {
  CONFIGURACION_CONOCIMIENTO,
  CONOCIMIENTO_REPOSITORY,
  SEMILLA_CONOCIMIENTO,
} from './tokens';

export interface ResultadoRestablecimiento {
  /** `sha256:<hex>` del estado leido dentro de la transaccion. */
  readonly huella: string;
  readonly versionSemilla: string;
  readonly estadoInicial: string;
  readonly corpus: CorpusConocimiento;
  readonly conteos: ConteosConocimiento;
}

/**
 * Borra la base de conocimiento y la repuebla desde la semilla, con el estado
 * inicial y el corpus pedidos, en una sola transaccion; devuelve la huella del
 * resultado (HU-24, HU-36). Solo existe en el perfil de experimento o de pruebas:
 * `ConocimientoModule` ni siquiera lo registra fuera de ellos, y aun asi se
 * verifica aqui.
 */
@Injectable()
export class RestablecerConocimientoUseCase {
  constructor(
    @Inject(CONOCIMIENTO_REPOSITORY) private readonly conocimiento: ConocimientoRepository,
    @Inject(CONFIGURACION_CONOCIMIENTO) private readonly configuracion: ConfiguracionConocimiento,
    @Inject(SEMILLA_CONOCIMIENTO) private readonly semilla: SemillaConocimiento,
  ) {}

  /**
   * @param seleccion por defecto `todo_operativo` con corpus `estandar`.
   * @throws RestablecimientoNoPermitidoError fuera del perfil permitido, sin tocar la base.
   * @throws SeleccionEstadoInvalidaError si el estado inicial o el corpus no existen, sin tocar la base.
   * @throws EstadoInconsistenteError si lo escrito no quedo identico a la semilla (se revierte).
   */
  async ejecutar(seleccion: Partial<SeleccionEstado> = {}): Promise<ResultadoRestablecimiento> {
    if (!this.configuracion.restablecimientoPermitido) {
      throw new RestablecimientoNoPermitidoError();
    }
    const estado = await this.conocimiento.restablecer(
      construirEstadoConocimiento(this.semilla, seleccion),
    );
    return {
      huella: calcularHuella(estado),
      versionSemilla: estado.entorno.versionSemilla,
      estadoInicial: estado.entorno.estadoInicial,
      corpus: estado.entorno.corpus,
      conteos: contarFilas(estado),
    };
  }
}

import { Injectable, inject } from '@angular/core';
import type {
  ManifiestoSalidas,
  ResultadosAnalisis,
} from '../../../domain/models/experimento/resultados-analisis';
import { EXPERIMENTO_REPOSITORY } from '../../di/tokens';

export interface ResultadosPublicados {
  readonly resultados: ResultadosAnalisis;
  /** `null` si el cuaderno no dejo manifiesto: las figuras no se listan, pero los datos si. */
  readonly manifiesto: ManifiestoSalidas | null;
}

/**
 * El archivo de resultados ya calculado y el manifiesto de figuras y tablas
 * (HU-MET-09). No calcula nada: si `resultados.json` no existe o su version no
 * coincide, el error llega al store y el panel lo declara.
 */
@Injectable({ providedIn: 'root' })
export class CargarResultadosUseCase {
  private readonly experimento = inject(EXPERIMENTO_REPOSITORY);

  async ejecutar(): Promise<ResultadosPublicados> {
    const resultados = await this.experimento.obtenerResultados();
    const manifiesto = await this.experimento.obtenerManifiestoSalidas().catch(() => null);
    return { resultados, manifiesto };
  }

  urlSalida(archivo: string): string {
    return this.experimento.urlSalida(archivo);
  }
}

import { Injectable, inject } from '@angular/core';
import type {
  CatalogoCorridas,
  CorridaDetallada,
} from '../../../domain/models/experimento/corrida';
import { EXPERIMENTO_REPOSITORY } from '../../di/tokens';

/** Catalogo de corridas del ejecutor y detalle de una de ellas. Nunca lanza ni borra una corrida. */
@Injectable({ providedIn: 'root' })
export class CargarCorridasUseCase {
  private readonly experimento = inject(EXPERIMENTO_REPOSITORY);

  listar(): Promise<CatalogoCorridas> {
    return this.experimento.listarCorridas();
  }

  detalle(nombre: string): Promise<CorridaDetallada> {
    return this.experimento.obtenerCorrida(nombre);
  }
}

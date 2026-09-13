import { Injectable, inject } from '@angular/core';
import type { ConsultaPolitica, Politica } from '../../domain/models/politica';
import { POLITICA_REPOSITORY } from '../di/tokens';

@Injectable({ providedIn: 'root' })
export class ConsultarPoliticaUseCase {
  private readonly politicas = inject(POLITICA_REPOSITORY);

  ejecutar(consulta: ConsultaPolitica): Promise<Politica> {
    return this.politicas.buscarPolitica(consulta);
  }
}

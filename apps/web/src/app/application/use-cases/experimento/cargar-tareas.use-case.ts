import { Injectable, inject } from '@angular/core';
import type { TareaEvaluacion } from '../../../domain/models/experimento/tarea-evaluacion';
import { EXPERIMENTO_REPOSITORY } from '../../di/tokens';

/** Las 40 tareas del conjunto, para el explorador y para elegir que correr. Solo lee. */
@Injectable({ providedIn: 'root' })
export class CargarTareasUseCase {
  private readonly experimento = inject(EXPERIMENTO_REPOSITORY);

  ejecutar(): Promise<readonly TareaEvaluacion[]> {
    return this.experimento.listarTareas();
  }
}

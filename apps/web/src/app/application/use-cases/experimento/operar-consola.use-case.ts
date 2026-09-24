import { Injectable, inject } from '@angular/core';
import type {
  EstadoConsola,
  EventoTrabajo,
  Trabajo,
} from '../../../domain/models/experimento/trabajo-consola';
import {
  type SeleccionCorrida,
  validarSeleccionCorrida,
} from '../../../domain/rules/experimento/comando-corrida.rules';
import { ErrorBackend } from '../../../domain/errors/error-backend';
import { CONSOLA_EXPERIMENTO_REPOSITORY } from '../../di/tokens';

/**
 * Lanzar y seguir trabajos de la consola del experimento (decision 39). La
 * seleccion se valida con la misma regla que arma el comando de la terminal,
 * asi lo que se lanza desde el panel es exactamente lo que se mostraria para
 * copiar.
 */
@Injectable({ providedIn: 'root' })
export class OperarConsolaUseCase {
  private readonly consola = inject(CONSOLA_EXPERIMENTO_REPOSITORY);

  estado(): Promise<EstadoConsola> {
    return this.consola.estado();
  }

  lanzarCorrida(seleccion: SeleccionCorrida): Promise<Trabajo> {
    const validacion = validarSeleccionCorrida(seleccion);
    if (!validacion.valida) {
      return Promise.reject(new ErrorBackend('validacion', validacion.mensaje));
    }
    return this.consola.lanzarCorrida(validacion.seleccion);
  }

  lanzarAnalisis(corrida: string): Promise<Trabajo> {
    return this.consola.lanzarAnalisis(corrida);
  }

  cancelar(trabajoId: string): Promise<Trabajo> {
    return this.consola.cancelar(trabajoId);
  }

  seguir(trabajoId: string, alRecibir: (evento: EventoTrabajo) => void): () => void {
    return this.consola.seguir(trabajoId, alRecibir);
  }
}

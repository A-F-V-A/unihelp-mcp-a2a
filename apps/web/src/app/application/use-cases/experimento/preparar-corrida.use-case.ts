import { Injectable, inject } from '@angular/core';
import type { IdentificadorArquitectura } from '@unihelp/dominio';
import type {
  ConfiguracionCorrida,
  SaludBackend,
} from '../../../domain/models/experimento/configuracion-corrida';
import { EXPERIMENTO_REPOSITORY } from '../../di/tokens';

/**
 * Lo que "Preparar corrida" necesita saber antes de que la persona copie el
 * comando: la configuracion vigente del ejecutor y si cada backend responde.
 * No lanza la corrida: eso ocurre en la terminal (HU-MET-14).
 */
@Injectable({ providedIn: 'root' })
export class PrepararCorridaUseCase {
  private readonly experimento = inject(EXPERIMENTO_REPOSITORY);

  configuracion(): Promise<ConfiguracionCorrida> {
    return this.experimento.obtenerConfiguracionCorrida();
  }

  comprobarBackend(arquitectura: IdentificadorArquitectura, url: string): Promise<SaludBackend> {
    return this.experimento.consultarSalud(arquitectura, url);
  }
}

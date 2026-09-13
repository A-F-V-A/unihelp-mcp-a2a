import { Injectable, inject } from '@angular/core';
import type { AreaServicio } from '@unihelp/dominio';
import type { EstadoServicio } from '../../domain/models/servicio';
import { SERVICIO_REPOSITORY } from '../di/tokens';

@Injectable({ providedIn: 'root' })
export class ConsultarEstadoServicioUseCase {
  private readonly servicios = inject(SERVICIO_REPOSITORY);

  ejecutar(servicio: AreaServicio): Promise<EstadoServicio> {
    return this.servicios.consultarEstado(servicio);
  }
}

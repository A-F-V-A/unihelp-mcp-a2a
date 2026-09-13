import { Injectable, inject } from '@angular/core';
import { type EstadoServicioDto, RUTAS_API } from '@unihelp/contratos';
import type { AreaServicio } from '@unihelp/dominio';
import type { EstadoServicio } from '../../domain/models/servicio';
import type { ServicioRepository } from '../../domain/ports/servicio.repository';
import { mapearEstadoServicio } from '../mappers/servicio.mapper';
import { ClienteApi } from './cliente-api';

@Injectable()
export class HttpServicioRepository implements ServicioRepository {
  private readonly api = inject(ClienteApi);

  async consultarEstado(servicio: AreaServicio): Promise<EstadoServicio> {
    const dto = await this.api.get<EstadoServicioDto>(RUTAS_API.estadoServicio(servicio));
    return mapearEstadoServicio(dto);
  }
}

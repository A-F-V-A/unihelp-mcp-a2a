import { Injectable, inject } from '@angular/core';
import type { AreaServicio } from '@unihelp/dominio';
import type { EstadoServicio } from '../../domain/models/servicio';
import type { ServicioRepository } from '../../domain/ports/servicio.repository';
import { mapearEstadoServicio } from '../mappers/servicio.mapper';
import { falloApi } from './errores-api';
import { ESTADOS_SERVICIO } from './fixtures/servicios.fixture';
import { materializarEstadoServicio } from './motor-escenarios';
import { SimuladorRed } from './simulador-red';

@Injectable()
export class MockServicioRepository implements ServicioRepository {
  private readonly red = inject(SimuladorRed);

  async consultarEstado(servicio: AreaServicio): Promise<EstadoServicio> {
    const dto = await this.red.responder('consultarEstado', () => {
      const fixture = ESTADOS_SERVICIO[servicio];
      if (!fixture) {
        throw falloApi('no-encontrado', `No existe el servicio ${servicio}.`, { servicio });
      }
      return materializarEstadoServicio(fixture, new Date());
    });
    return mapearEstadoServicio(dto);
  }
}

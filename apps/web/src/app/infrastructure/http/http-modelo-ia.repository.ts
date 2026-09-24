import { Injectable, inject } from '@angular/core';
import {
  type ConfiguracionModeloIaDto,
  RUTAS_API,
  type SeleccionModeloIaDto,
} from '@unihelp/contratos';
import type { CatalogoModeloIa, SeleccionModeloIa } from '../../domain/models/modelo-ia';
import type { ModeloIaRepository } from '../../domain/ports/modelo-ia.repository';
import { mapearCatalogoModeloIa } from '../mappers/modelo-ia.mapper';
import { ClienteApi } from './cliente-api';

@Injectable()
export class HttpModeloIaRepository implements ModeloIaRepository {
  private readonly api = inject(ClienteApi);

  async obtener(): Promise<CatalogoModeloIa> {
    return mapearCatalogoModeloIa(await this.api.get<ConfiguracionModeloIaDto>(RUTAS_API.modeloIa));
  }

  async seleccionar(seleccion: SeleccionModeloIa): Promise<CatalogoModeloIa> {
    const cuerpo: SeleccionModeloIaDto = seleccion;
    return mapearCatalogoModeloIa(
      await this.api.put<ConfiguracionModeloIaDto>(RUTAS_API.modeloIa, cuerpo),
    );
  }
}

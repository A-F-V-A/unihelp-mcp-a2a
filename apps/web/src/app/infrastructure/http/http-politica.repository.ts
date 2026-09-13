import { Injectable, inject } from '@angular/core';
import { type PoliticaDto, RUTAS_API } from '@unihelp/contratos';
import type { ConsultaPolitica, Politica } from '../../domain/models/politica';
import type { PoliticaRepository } from '../../domain/ports/politica.repository';
import { mapearPolitica } from '../mappers/politica.mapper';
import { ClienteApi } from './cliente-api';

@Injectable()
export class HttpPoliticaRepository implements PoliticaRepository {
  private readonly api = inject(ClienteApi);

  async buscarPolitica(consulta: ConsultaPolitica): Promise<Politica> {
    const params: Record<string, string> = consulta.version ? { version: consulta.version } : {};
    const dto = await this.api.get<PoliticaDto>(RUTAS_API.politica(consulta.codigo), params);
    return mapearPolitica(dto);
  }
}

import { Injectable, inject } from '@angular/core';
import type { ConsultaPolitica, Politica } from '../../domain/models/politica';
import type { PoliticaRepository } from '../../domain/ports/politica.repository';
import { mapearPolitica } from '../mappers/politica.mapper';
import { falloApi } from './errores-api';
import { POLITICAS } from './fixtures/politicas.fixture';
import { SimuladorRed } from './simulador-red';

@Injectable()
export class MockPoliticaRepository implements PoliticaRepository {
  private readonly red = inject(SimuladorRed);

  async buscarPolitica(consulta: ConsultaPolitica): Promise<Politica> {
    const dto = await this.red.responder('buscarPolitica', () => {
      const politica = POLITICAS.find((candidata) => candidata.codigo === consulta.codigo);
      if (!politica) {
        throw falloApi('no-encontrado', `No existe la política ${consulta.codigo}.`, {
          codigo: consulta.codigo,
        });
      }
      if (consulta.version && consulta.version !== politica.version) {
        throw falloApi(
          'no-encontrado',
          `La versión ${consulta.version} de ${consulta.codigo} no está publicada. La vigente es la ${politica.version}.`,
          { codigo: consulta.codigo, versionVigente: politica.version },
        );
      }
      return politica;
    });
    return mapearPolitica(dto);
  }
}

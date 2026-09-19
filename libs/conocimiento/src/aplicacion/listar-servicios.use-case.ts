import { Inject, Injectable } from '@nestjs/common';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { compararTexto } from '../dominio/reglas/estado-canonico.rules';
import type { Servicio } from '../dominio/servicio';
import { CONOCIMIENTO_REPOSITORY } from './tokens';

/**
 * Lista los servicios de la base, ordenados por codigo en orden binario (RM-10).
 * Permite traducir entre el codigo del servicio (`aula_virtual`) y el area del
 * vocabulario compartido (`plataforma-virtual`) sin repetir la semilla en codigo.
 */
@Injectable()
export class ListarServiciosUseCase {
  constructor(
    @Inject(CONOCIMIENTO_REPOSITORY) private readonly conocimiento: ConocimientoRepository,
  ) {}

  async ejecutar(): Promise<readonly Servicio[]> {
    const estado = await this.conocimiento.leerEstado();
    return [...estado.servicios].sort((a, b) => compararTexto(a.codigo, b.codigo));
  }
}

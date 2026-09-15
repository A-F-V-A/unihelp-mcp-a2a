import { Inject, Injectable } from '@nestjs/common';
import { ServicioNoEncontradoError } from '../dominio/errores';
import type { ComponentesDeServicio } from '../dominio/grafo';
import type { ConocimientoRepository } from '../dominio/puertos/conocimiento.repository';
import { CONOCIMIENTO_REPOSITORY } from './tokens';

/**
 * Recorre servicio -> componentes y devuelve el estado publicado del servicio
 * (alcance, comunicado, ventana) y el de cada componente, con la ventana solo si
 * fue publicada (HU-09, HU-10). No calcula prioridad ni interpreta el
 * comunicado: eso es de cada arquitectura.
 */
@Injectable()
export class ConsultarComponentesDeServicioUseCase {
  constructor(
    @Inject(CONOCIMIENTO_REPOSITORY) private readonly conocimiento: ConocimientoRepository,
  ) {}

  /** @throws ServicioNoEncontradoError si el codigo no existe. */
  async ejecutar(servicioCodigo: string): Promise<ComponentesDeServicio> {
    const resultado = await this.conocimiento.obtenerComponentesDeServicio(servicioCodigo.trim());
    if (resultado === null) {
      throw new ServicioNoEncontradoError(servicioCodigo);
    }
    return resultado;
  }
}

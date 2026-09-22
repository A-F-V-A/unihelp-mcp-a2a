import { Inject, Injectable } from '@nestjs/common';
import { ListarServiciosUseCase, type Servicio } from '@unihelp/conocimiento';
import type { AreaServicio } from '@unihelp/dominio';

/**
 * Traduce entre el codigo del servicio (`aula_virtual`, el de las herramientas)
 * y el area del contrato de red (`plataforma-virtual`, el del frontend). Lee la
 * relacion de la base de conocimiento una vez, en vez de repetir la semilla en codigo.
 */
@Injectable()
export class CatalogoServicios {
  private servicios: Promise<readonly Servicio[]> | null = null;

  constructor(@Inject(ListarServiciosUseCase) private readonly listar: ListarServiciosUseCase) {}

  async servicio(codigo: string): Promise<Servicio | undefined> {
    return (await this.todos()).find((s) => s.codigo === codigo);
  }

  /** Servicios de un area, en orden binario de codigo. */
  async deArea(area: AreaServicio): Promise<readonly Servicio[]> {
    return (await this.todos()).filter((s) => s.area === area);
  }

  private todos(): Promise<readonly Servicio[]> {
    this.servicios ??= this.listar.ejecutar().catch((fallo: unknown) => {
      this.servicios = null;
      throw fallo;
    });
    return this.servicios;
  }
}

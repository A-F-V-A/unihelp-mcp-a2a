import { Controller, Get, Inject, Param } from '@nestjs/common';
import type { SaludSistemaDto, SaludSistemasDto, SistemaEmuladoDto } from '@unihelp/contratos';
import { SaludDeSistemas } from '../salud-de-sistemas';
import { CatalogoSistemas } from '../sistemas-emulados';

/**
 * Vista de conjunto del simulador: el catalogo de sistemas emulados y su estado.
 * Es la ruta que se compara contra el YAML de la tarea para comprobar que el
 * entorno quedo como la tarea pide.
 */
@Controller('simulacion')
export class PanelController {
  constructor(
    @Inject(SaludDeSistemas) private readonly salud: SaludDeSistemas,
    @Inject(CatalogoSistemas) private readonly catalogo: CatalogoSistemas,
  ) {}

  /** `GET /simulacion/salud`: los cuatro sistemas, como `estado_inicial.servicios`. */
  @Get('salud')
  todos(): Promise<SaludSistemasDto> {
    return this.salud.deTodos();
  }

  /** `GET /simulacion/sistemas`: el catalogo, sin estado. */
  @Get('sistemas')
  sistemas(): Promise<readonly SistemaEmuladoDto[]> {
    return this.catalogo.todos();
  }

  /** `GET /simulacion/sistemas/:codigo/salud`: uno por codigo, sin conocer su ruta propia. */
  @Get('sistemas/:codigo/salud')
  sistema(@Param('codigo') codigo: string): Promise<SaludSistemaDto> {
    return this.salud.deUno(codigo);
  }
}

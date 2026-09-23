import { Controller, Get, Inject } from '@nestjs/common';
import type { SaludSistemaDto } from '@unihelp/contratos';
import { SaludDeSistemas } from '../salud-de-sistemas';

/**
 * Matricula en linea (inscripcion, cancelacion y consulta de estado).
 *
 * Cada sistema emulado tiene su propio controlador y su propia ruta, como la
 * tendria si fuera un servicio de verdad operado por su dependencia. La consulta
 * es identica en los cuatro y vive en `SaludDeSistemas`: aqui solo se fija de
 * que sistema se trata.
 */
@Controller('simulacion/matricula')
export class MatriculaController {
  constructor(@Inject(SaludDeSistemas) private readonly salud: SaludDeSistemas) {}

  /** `GET /simulacion/matricula/salud`. */
  @Get('salud')
  consultar(): Promise<SaludSistemaDto> {
    return this.salud.deUno('matricula');
  }
}

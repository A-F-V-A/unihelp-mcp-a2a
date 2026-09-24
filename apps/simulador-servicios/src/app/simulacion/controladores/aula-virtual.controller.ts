import { Controller, Get, Inject } from '@nestjs/common';
import type { SaludSistemaDto } from '@unihelp/contratos';
import { SaludDeSistemas } from '../salud-de-sistemas';

/**
 * Aula virtual (plataforma de cursos). Nivel de servicio alto.
 *
 * Cada sistema emulado tiene su propio controlador y su propia ruta, como la
 * tendria si fuera un servicio de verdad operado por su dependencia. La consulta
 * es identica en los cuatro y vive en `SaludDeSistemas`: aqui solo se fija de
 * que sistema se trata.
 */
@Controller('simulacion/aula-virtual')
export class AulaVirtualController {
  constructor(@Inject(SaludDeSistemas) private readonly salud: SaludDeSistemas) {}

  /** `GET /simulacion/aula-virtual/salud`. */
  @Get('salud')
  consultar(): Promise<SaludSistemaDto> {
    return this.salud.deUno('aula_virtual');
  }
}

import { Controller, Get, Inject } from '@nestjs/common';
import type { SaludSistemaDto } from '@unihelp/contratos';
import { SaludDeSistemas } from '../salud-de-sistemas';

/**
 * Autenticacion institucional. Es el unico sistema de nivel critico: la tabla de prioridad de docs/10 lo pondera distinto (T-DIA-002, T-DIA-009).
 *
 * Cada sistema emulado tiene su propio controlador y su propia ruta, como la
 * tendria si fuera un servicio de verdad operado por su dependencia. La consulta
 * es identica en los cuatro y vive en `SaludDeSistemas`: aqui solo se fija de
 * que sistema se trata.
 */
@Controller('simulacion/autenticacion')
export class AutenticacionController {
  constructor(@Inject(SaludDeSistemas) private readonly salud: SaludDeSistemas) {}

  /** `GET /simulacion/autenticacion/salud`. */
  @Get('salud')
  consultar(): Promise<SaludSistemaDto> {
    return this.salud.deUno('autenticacion');
  }
}

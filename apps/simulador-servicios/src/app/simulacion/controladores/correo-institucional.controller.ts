import { Controller, Get, Inject } from '@nestjs/common';
import type { SaludSistemaDto } from '@unihelp/contratos';
import { SaludDeSistemas } from '../salud-de-sistemas';

/**
 * Correo institucional. Comparte el area `soporte-tecnico` con autenticacion, y por eso la ruta del contrato de triaje (`/api/servicios/:area/estado`) no los distingue y esta si.
 *
 * Cada sistema emulado tiene su propio controlador y su propia ruta, como la
 * tendria si fuera un servicio de verdad operado por su dependencia. La consulta
 * es identica en los cuatro y vive en `SaludDeSistemas`: aqui solo se fija de
 * que sistema se trata.
 */
@Controller('simulacion/correo-institucional')
export class CorreoInstitucionalController {
  constructor(@Inject(SaludDeSistemas) private readonly salud: SaludDeSistemas) {}

  /** `GET /simulacion/correo-institucional/salud`. */
  @Get('salud')
  consultar(): Promise<SaludSistemaDto> {
    return this.salud.deUno('correo_institucional');
  }
}

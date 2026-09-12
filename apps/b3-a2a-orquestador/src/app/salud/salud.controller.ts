import { Controller, Get } from '@nestjs/common';
import type { RespuestaSalud } from '@unihelp/contratos';
import { SaludService } from './salud.service';

/**
 * Expuesto en `/health` (fuera del prefijo `/api`)
 * para poder verificar en cualquier momento cual arquitectura esta corriendo.
 */
@Controller('health')
export class SaludController {
  constructor(private readonly saludService: SaludService) {}

  @Get()
  consultar(): RespuestaSalud {
    return this.saludService.consultar();
  }
}

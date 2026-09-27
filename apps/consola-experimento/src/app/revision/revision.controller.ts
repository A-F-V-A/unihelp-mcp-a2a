import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import type {
  AdjudicacionDto,
  CalificacionDto,
  EstadoAdjudicacionDto,
  MuestraRevisionDto,
  ProgresoRevisorDto,
} from '@unihelp/contratos';
import { RevisionService } from './revision.service';

/**
 * Rutas de `RUTAS_REVISION`, fuera del prefijo `/api` (ver `main.ts`). El cuerpo
 * llega como `unknown`: lo valida por completo el servicio.
 */
@Controller('revision')
export class RevisionController {
  constructor(private readonly revision: RevisionService) {}

  @Get('muestra')
  @Header('Cache-Control', 'no-store')
  muestra(): MuestraRevisionDto {
    return this.revision.muestra();
  }

  @Get('revisores/:rol')
  @Header('Cache-Control', 'no-store')
  progreso(@Param('rol') rol: string): ProgresoRevisorDto {
    return this.revision.progreso(rol);
  }

  @Post('calificaciones')
  @HttpCode(201)
  calificar(@Body() cuerpo: unknown): CalificacionDto {
    return this.revision.calificar(cuerpo);
  }

  @Get('adjudicacion')
  @Header('Cache-Control', 'no-store')
  adjudicacion(): EstadoAdjudicacionDto {
    return this.revision.adjudicacion();
  }

  @Post('adjudicaciones')
  @HttpCode(201)
  adjudicar(@Body() cuerpo: unknown): AdjudicacionDto {
    return this.revision.adjudicar(cuerpo);
  }
}

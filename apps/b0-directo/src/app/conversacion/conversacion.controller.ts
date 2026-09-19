import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import type {
  HistorialConversacionDto,
  RespuestaMensajeDto,
  ResumenConversacionDto,
} from '@unihelp/contratos';
import { CONFIGURACION_B0, type ConfiguracionB0 } from '../configuracion/configuracion-b0';
import { ErrorApi } from '../http/error-api';
import { AtenderTurnoUseCase, resumen } from './atender-turno.use-case';
import { RepositorioConversaciones } from './repositorio-conversaciones';

/**
 * Rutas de conversacion de `RUTAS_API` (HU-01, HU-04). Solo traduce HTTP al caso
 * de uso y de vuelta: responde exactamente el contrato (regla 5 de AGENTS.md).
 */
@Controller('conversaciones')
export class ConversacionController {
  constructor(
    @Inject(AtenderTurnoUseCase) private readonly atender: AtenderTurnoUseCase,
    @Inject(RepositorioConversaciones) private readonly conversaciones: RepositorioConversaciones,
    @Inject(CONFIGURACION_B0) private readonly configuracion: ConfiguracionB0,
  ) {}

  /** `POST /api/conversaciones/mensajes`. */
  @Post('mensajes')
  @HttpCode(200)
  enviar(
    @Body() cuerpo: unknown,
    @Headers('x-trace-id') traceId: string | undefined,
  ): Promise<RespuestaMensajeDto> {
    const datos = (cuerpo ?? {}) as Record<string, unknown>;
    const conversacionId = datos['conversacionId'];
    if (conversacionId !== null && typeof conversacionId !== 'string') {
      throw new ErrorApi('validacion', 'El campo conversacionId debe ser texto o null.', {
        campo: 'conversacionId',
      });
    }
    return this.atender.ejecutar({
      conversacionId,
      texto: typeof datos['texto'] === 'string' ? datos['texto'] : '',
      traceId: traceId?.trim() || null,
    });
  }

  /** `GET /api/conversaciones`: de la mas reciente a la mas antigua. */
  @Get()
  listar(): readonly ResumenConversacionDto[] {
    return this.conversaciones.listar().map((c) => resumen(c, this.configuracion.limites.turnos));
  }

  /** `GET /api/conversaciones/:id/mensajes`. */
  @Get(':id/mensajes')
  historial(@Param('id') id: string): HistorialConversacionDto {
    const conversacion = this.conversaciones.obtener(id);
    if (conversacion === undefined) {
      throw new ErrorApi('no-encontrado', 'La conversación no existe o ya expiró.', {
        conversacionId: id,
      });
    }
    return {
      conversacionId: id,
      mensajes: conversacion.mensajes,
      turnos: resumen(conversacion, this.configuracion.limites.turnos).turnos,
    };
  }

  /** `DELETE /api/conversaciones/:id`: borra el historial; los tickets creados se conservan. */
  @Delete(':id')
  @HttpCode(204)
  eliminar(@Param('id') id: string): void {
    if (!this.conversaciones.eliminar(id)) {
      throw new ErrorApi('no-encontrado', 'La conversación no existe o ya expiró.', {
        conversacionId: id,
      });
    }
  }
}

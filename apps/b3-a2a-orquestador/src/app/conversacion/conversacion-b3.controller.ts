import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import type {
  EnviarMensajeDto,
  HistorialConversacionDto,
  RespuestaMensajeDto,
  ResumenConversacionDto,
} from '@unihelp/contratos';
import { CABECERA_TRACE_ID } from '@unihelp/contratos';
import { TriajeService } from '../triaje/triaje.service';

/**
 * Controlador REST para el frontend de UniHelp en la arquitectura B3 (HU-01, HU-04).
 *
 * Implementa exactamente el mismo contrato que B0 y B1 bajo `/api/conversaciones`
 * para garantizar la comparabilidad cientifica (regla 5 de AGENTS.md, H3).
 */
@Controller('conversaciones')
export class ConversacionB3Controller {
  constructor(private readonly triajeService: TriajeService) {}

  @Post('mensajes')
  @HttpCode(HttpStatus.OK)
  async enviarMensaje(
    @Body() dto: EnviarMensajeDto,
    @Headers(CABECERA_TRACE_ID) traceId?: string,
  ): Promise<RespuestaMensajeDto> {
    const res = await this.triajeService.procesarTurno(
      dto.conversacionId,
      dto.texto,
      traceId,
    );
    return res.respuestaMensaje;
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async enviarMensajeRaiz(
    @Body() dto: EnviarMensajeDto,
    @Headers(CABECERA_TRACE_ID) traceId?: string,
  ): Promise<RespuestaMensajeDto> {
    return this.enviarMensaje(dto, traceId);
  }

  @Get()
  listarConversaciones(): readonly ResumenConversacionDto[] {
    return this.triajeService.listarConversaciones();
  }

  @Get(':id/mensajes')
  obtenerHistorial(@Param('id') id: string): HistorialConversacionDto {
    return this.triajeService.obtenerHistorial(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarConversacion(@Param('id') id: string): void {
    this.triajeService.eliminarConversacion(id);
  }
}

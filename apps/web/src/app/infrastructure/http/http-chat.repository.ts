import { Injectable, inject } from '@angular/core';
import {
  type EnviarMensajeDto,
  type HistorialConversacionDto,
  RUTAS_API,
  type RespuestaMensajeDto,
  type ResumenConversacionDto,
} from '@unihelp/contratos';
import type {
  HistorialConversacion,
  RespuestaMensaje,
  ResumenConversacion,
  SolicitudMensaje,
} from '../../domain/models/conversacion';
import type { ChatRepository } from '../../domain/ports/chat.repository';
import {
  mapearHistorial,
  mapearRespuestaMensaje,
  mapearResumenConversacion,
} from '../mappers/conversacion.mapper';
import { ClienteApi } from './cliente-api';

@Injectable()
export class HttpChatRepository implements ChatRepository {
  private readonly api = inject(ClienteApi);

  async enviarMensaje(solicitud: SolicitudMensaje): Promise<RespuestaMensaje> {
    const cuerpo: EnviarMensajeDto = {
      conversacionId: solicitud.conversacionId,
      texto: solicitud.texto,
    };
    const dto = await this.api.post<RespuestaMensajeDto>(RUTAS_API.mensajes, cuerpo);
    return mapearRespuestaMensaje(dto);
  }

  async obtenerHistorial(conversacionId: string): Promise<HistorialConversacion> {
    const dto = await this.api.get<HistorialConversacionDto>(RUTAS_API.historial(conversacionId));
    return mapearHistorial(dto);
  }

  async listarConversaciones(): Promise<readonly ResumenConversacion[]> {
    const dtos = await this.api.get<readonly ResumenConversacionDto[]>(RUTAS_API.conversaciones);
    return dtos.map(mapearResumenConversacion);
  }

  async eliminarConversacion(conversacionId: string): Promise<void> {
    await this.api.delete<null>(RUTAS_API.conversacion(conversacionId));
  }
}

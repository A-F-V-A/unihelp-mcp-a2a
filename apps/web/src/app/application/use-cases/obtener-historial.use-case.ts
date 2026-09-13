import { Injectable, inject } from '@angular/core';
import type { HistorialConversacion } from '../../domain/models/conversacion';
import { aplicarReglasRespuesta } from '../../domain/rules/respuesta.rules';
import { CHAT_REPOSITORY } from '../di/tokens';

@Injectable({ providedIn: 'root' })
export class ObtenerHistorialUseCase {
  private readonly chat = inject(CHAT_REPOSITORY);

  async ejecutar(conversacionId: string): Promise<HistorialConversacion> {
    const historial = await this.chat.obtenerHistorial(conversacionId);
    return { ...historial, mensajes: historial.mensajes.map(aplicarReglasRespuesta) };
  }
}

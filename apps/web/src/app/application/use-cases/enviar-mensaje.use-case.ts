import { Injectable, inject } from '@angular/core';
import { ErrorBackend } from '../../domain/errors/error-backend';
import type { RespuestaMensaje, SolicitudMensaje } from '../../domain/models/conversacion';
import { aplicarReglasRespuesta } from '../../domain/rules/respuesta.rules';
import { validarSolicitud } from '../../domain/rules/solicitud.rules';
import { CHAT_REPOSITORY } from '../di/tokens';

/** Envia un turno de la conversacion y aplica las reglas de dominio a la respuesta. */
@Injectable({ providedIn: 'root' })
export class EnviarMensajeUseCase {
  private readonly chat = inject(CHAT_REPOSITORY);

  async ejecutar(solicitud: SolicitudMensaje): Promise<RespuestaMensaje> {
    const validacion = validarSolicitud(solicitud.texto);
    if (!validacion.valida) {
      throw new ErrorBackend('validacion', validacion.mensaje, { motivo: validacion.motivo });
    }

    const resultado = await this.chat.enviarMensaje({ ...solicitud, texto: validacion.texto });
    return { ...resultado, respuesta: aplicarReglasRespuesta(resultado.respuesta) };
  }
}

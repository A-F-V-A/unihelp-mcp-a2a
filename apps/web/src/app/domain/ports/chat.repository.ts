import type {
  HistorialConversacion,
  RespuestaMensaje,
  ResumenConversacion,
  SolicitudMensaje,
} from '../models/conversacion';

/**
 * Puerto de la conversacion (HU-04). Las implementaciones rechazan con
 * `ErrorBackend`; nunca con errores de transporte.
 */
export interface ChatRepository {
  /** Envia un turno y obtiene la respuesta clasificada del asistente. */
  enviarMensaje(solicitud: SolicitudMensaje): Promise<RespuestaMensaje>;

  /** Recupera todos los mensajes de una conversacion existente. */
  obtenerHistorial(conversacionId: string): Promise<HistorialConversacion>;

  /** Conversaciones del solicitante, de la mas reciente a la mas antigua. */
  listarConversaciones(): Promise<readonly ResumenConversacion[]>;

  /** Borra la conversacion y su historial. Los tickets ya creados no se ven afectados. */
  eliminarConversacion(conversacionId: string): Promise<void>;
}

/**
 * Rutas y formato de error de la API de triaje (bajo el prefijo `/api`).
 *
 * El frontend se construyo ANTES que el backend, asi que este archivo es la
 * especificacion: las cuatro arquitecturas deben exponer exactamente estas
 * rutas y responder estos cuerpos para que el mismo frontend funcione contra
 * cualquiera de ellas.
 */

export const RUTAS_API = {
  /** `POST` {@link EnviarMensajeDto} -> {@link RespuestaMensajeDto}. Crea la conversacion si `conversacionId` es `null`. */
  /** `GET` -> {@link ResumenConversacionDto}[], de la mas reciente a la mas antigua. */
  conversaciones: '/api/conversaciones',
  /** `DELETE` -> 204. Borra la conversacion y su historial; los tickets creados se conservan. */
  conversacion: (conversacionId: string) =>
    `/api/conversaciones/${encodeURIComponent(conversacionId)}`,
  mensajes: '/api/conversaciones/mensajes',
  /** `GET` -> {@link HistorialConversacionDto}. */
  historial: (conversacionId: string) =>
    `/api/conversaciones/${encodeURIComponent(conversacionId)}/mensajes`,
  /** `POST` {@link SolicitarPropuestaTicketDto} -> {@link PropuestaTicketDto}. No crea el ticket. */
  propuestasTicket: '/api/tickets/propuestas',
  /** `POST` {@link ConfirmarPropuestaTicketDto} -> {@link TicketDto}. Unica ruta que crea un ticket. */
  confirmarPropuesta: (propuestaId: string) =>
    `/api/tickets/propuestas/${encodeURIComponent(propuestaId)}/confirmacion`,
  /** `POST` (sin cuerpo) -> {@link PropuestaTicketDto} en estado `rechazada`. */
  rechazarPropuesta: (propuestaId: string) =>
    `/api/tickets/propuestas/${encodeURIComponent(propuestaId)}/rechazo`,
  /** `GET` -> {@link ConfiguracionModeloIaDto}. `PUT` {@link SeleccionModeloIaDto} -> {@link ConfiguracionModeloIaDto}. */
  modeloIa: '/api/modelo-ia',
  /** `GET` con `?version=` opcional -> {@link PoliticaDto}. */
  politica: (codigo: string) => `/api/politicas/${encodeURIComponent(codigo)}`,
  /** `GET` -> {@link EstadoServicioDto}. */
  estadoServicio: (servicio: string) => `/api/servicios/${encodeURIComponent(servicio)}/estado`,
} as const;

/**
 * Codigos de error que puede devolver el backend, con el status HTTP esperado:
 *
 * | codigo                   | HTTP |
 * | ------------------------ | ---- |
 * | `validacion`             | 400  |
 * | `no-encontrado`          | 404  |
 * | `conflicto`              | 409  |
 * | `limite-turnos`          | 429  |
 * | `interno`                | 500  |
 * | `servicio-no-disponible` | 503  |
 */
export const CODIGOS_ERROR_API = [
  'validacion',
  'no-encontrado',
  'conflicto',
  'limite-turnos',
  'interno',
  'servicio-no-disponible',
] as const;

export type CodigoErrorApi = (typeof CODIGOS_ERROR_API)[number];

/** Cuerpo de cualquier respuesta de error de la API. */
export interface ErrorApiDto {
  readonly codigo: CodigoErrorApi;
  /** Mensaje legible, apto para mostrarse al solicitante. */
  readonly mensaje: string;
  /** Datos adicionales (campo invalido, turnos maximos, estado actual...). */
  readonly detalles?: Readonly<Record<string, string | number>>;
}

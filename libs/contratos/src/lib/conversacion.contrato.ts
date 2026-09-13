import type { TipoCanalAtencion, TipoClasificacion } from '@unihelp/dominio';
import type { CitaPoliticaDto } from './politica.contrato';
import type { EstadoServicioDto } from './servicio.contrato';
import type { PropuestaTicketDto, TicketDto } from './ticket.contrato';

/** Como entendio el sistema la solicitud (HU-02, HU-03). */
export interface ClasificacionDto {
  readonly tipo: TipoClasificacion;
  /** Entre 0 y 1. */
  readonly confianza: number;
}

/** Canal correcto al que acudir cuando la solicitud esta fuera de alcance. */
export interface CanalAtencionDto {
  readonly nombre: string;
  readonly tipo: TipoCanalAtencion;
  /** URL, correo o telefono, segun `tipo`. */
  readonly contacto: string;
  readonly horario: string | null;
}

/**
 * Pieza de contenido de una respuesta del asistente. Una respuesta compuesta
 * combina varias (texto + politicas + estado de servicio, por ejemplo).
 */
export type BloqueRespuestaDto =
  | { readonly tipo: 'texto'; readonly texto: string }
  /** Maximo tres politicas (ver `MAXIMO_POLITICAS_POR_RESPUESTA`). */
  | { readonly tipo: 'politicas'; readonly politicas: readonly CitaPoliticaDto[] }
  | { readonly tipo: 'estado-servicio'; readonly estado: EstadoServicioDto }
  /** Mantenimiento programado: se informa y NO se propone ticket (HU-12). */
  | { readonly tipo: 'aviso-mantenimiento'; readonly estado: EstadoServicioDto }
  | { readonly tipo: 'fuera-de-alcance'; readonly motivo: string; readonly canal: CanalAtencionDto }
  | { readonly tipo: 'propuesta-ticket'; readonly propuesta: PropuestaTicketDto }
  | { readonly tipo: 'ticket-creado'; readonly ticket: TicketDto };

export type TipoBloqueRespuesta = BloqueRespuestaDto['tipo'];

/** Consumo de turnos de la conversacion (RNF-04). */
export interface TurnosDto {
  readonly usados: number;
  readonly maximos: number;
}

export interface MensajeUsuarioDto {
  readonly id: string;
  readonly rol: 'usuario';
  /** Turno al que pertenece, empezando en 1. */
  readonly turno: number;
  readonly texto: string;
  /** ISO 8601. */
  readonly enviadoEn: string;
}

export interface MensajeAsistenteDto {
  readonly id: string;
  readonly rol: 'asistente';
  readonly turno: number;
  /** `null` en mensajes que no responden a una solicitud (ej.: propuesta o ticket creado). */
  readonly clasificacion: ClasificacionDto | null;
  readonly bloques: readonly BloqueRespuestaDto[];
  /** ISO 8601. */
  readonly enviadoEn: string;
}

export type MensajeDto = MensajeUsuarioDto | MensajeAsistenteDto;

/**
 * Siguiente paso que el backend sugiere al cliente. `proponer-ticket` indica
 * que el diagnostico amerita pedir una propuesta con
 * `POST /api/tickets/propuestas`; no crea nada por si mismo.
 */
export type AccionSugeridaDto = 'proponer-ticket' | null;

/** Elemento de `GET /api/conversaciones`, que se ordena de la mas reciente a la mas antigua. */
export interface ResumenConversacionDto {
  readonly id: string;
  /** Titulo corto y legible, generado a partir del inicio de la conversacion. */
  readonly titulo: string;
  /** ISO 8601. */
  readonly creadaEn: string;
  /** ISO 8601 del ultimo mensaje. */
  readonly actualizadaEn: string;
  readonly turnos: TurnosDto;
}

/** `POST /api/conversaciones/mensajes` (HU-04). */
export interface EnviarMensajeDto {
  /** `null` para iniciar una conversacion nueva. */
  readonly conversacionId: string | null;
  /** Texto libre de 10 a 2000 caracteres. */
  readonly texto: string;
}

export interface RespuestaMensajeDto {
  readonly conversacionId: string;
  /** Resumen ya actualizado: el cliente refresca su lista sin otra peticion. */
  readonly conversacion: ResumenConversacionDto;
  /** El mensaje enviado, ya con su id y turno definitivos. */
  readonly mensajeUsuario: MensajeUsuarioDto;
  readonly respuesta: MensajeAsistenteDto;
  readonly turnos: TurnosDto;
  readonly accionSugerida: AccionSugeridaDto;
}

/** `GET /api/conversaciones/:conversacionId/mensajes`. */
export interface HistorialConversacionDto {
  readonly conversacionId: string;
  /** En orden cronologico. */
  readonly mensajes: readonly MensajeDto[];
  readonly turnos: TurnosDto;
}

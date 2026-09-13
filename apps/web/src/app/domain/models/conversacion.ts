import type { TipoCanalAtencion, TipoClasificacion } from '@unihelp/dominio';
import type { CitaPolitica } from './politica';
import type { EstadoServicio } from './servicio';
import type { PropuestaTicket, Ticket } from './ticket';

export interface Clasificacion {
  readonly tipo: TipoClasificacion;
  /** Entre 0 y 1. */
  readonly confianza: number;
}

export interface CanalAtencion {
  readonly nombre: string;
  readonly tipo: TipoCanalAtencion;
  readonly contacto: string;
  readonly horario: string | null;
}

export type BloqueRespuesta =
  | { readonly tipo: 'texto'; readonly texto: string }
  | { readonly tipo: 'politicas'; readonly politicas: readonly CitaPolitica[] }
  | { readonly tipo: 'estado-servicio'; readonly estado: EstadoServicio }
  | { readonly tipo: 'aviso-mantenimiento'; readonly estado: EstadoServicio }
  | { readonly tipo: 'fuera-de-alcance'; readonly motivo: string; readonly canal: CanalAtencion }
  | { readonly tipo: 'propuesta-ticket'; readonly propuesta: PropuestaTicket }
  | { readonly tipo: 'ticket-creado'; readonly ticket: Ticket };

export interface Turnos {
  readonly usados: number;
  readonly maximos: number;
}

export interface MensajeUsuario {
  readonly id: string;
  readonly rol: 'usuario';
  readonly turno: number;
  readonly texto: string;
  readonly enviadoEn: Date;
}

export interface MensajeAsistente {
  readonly id: string;
  readonly rol: 'asistente';
  readonly turno: number;
  readonly clasificacion: Clasificacion | null;
  readonly bloques: readonly BloqueRespuesta[];
  readonly enviadoEn: Date;
}

export type Mensaje = MensajeUsuario | MensajeAsistente;

export type AccionSugerida = 'proponer-ticket' | null;

export interface SolicitudMensaje {
  readonly conversacionId: string | null;
  readonly texto: string;
}

export interface ResumenConversacion {
  readonly id: string;
  readonly titulo: string;
  readonly creadaEn: Date;
  readonly actualizadaEn: Date;
  readonly turnos: Turnos;
}

export interface RespuestaMensaje {
  readonly conversacionId: string;
  readonly conversacion: ResumenConversacion;
  readonly mensajeUsuario: MensajeUsuario;
  readonly respuesta: MensajeAsistente;
  readonly turnos: Turnos;
  readonly accionSugerida: AccionSugerida;
}

export interface HistorialConversacion {
  readonly conversacionId: string;
  readonly mensajes: readonly Mensaje[];
  readonly turnos: Turnos;
}

import type {
  AreaServicio,
  EstadoIncidente,
  EstadoPropuestaTicket,
  Prioridad,
} from '@unihelp/dominio';

/** `POST /api/tickets/propuestas`: el backend arma la propuesta a partir de la conversacion. */
export interface SolicitarPropuestaTicketDto {
  readonly conversacionId: string;
}

/** Propuesta de ticket que el solicitante debe confirmar o rechazar (HU-13, HU-14, HU-15). */
export interface PropuestaTicketDto {
  readonly id: string;
  readonly conversacionId: string;
  readonly servicio: AreaServicio;
  readonly categoria: string;
  readonly prioridad: Prioridad;
  /** Una linea legible. */
  readonly resumen: string;
  /** Descripcion que quedaria registrada en el ticket. */
  readonly descripcion: string;
  readonly estado: EstadoPropuestaTicket;
  /** ISO 8601. */
  readonly creadaEn: string;
  /** ISO 8601 del momento en que se confirmo o rechazo. */
  readonly resueltaEn: string | null;
  /** Numero del ticket creado, solo si `estado` es `confirmada`. */
  readonly ticketNumero: string | null;
}

/**
 * Cuerpo de `POST /api/tickets/propuestas/:id/confirmacion`.
 *
 * `confirmacionExplicita: true` es obligatorio: el backend debe responder
 * `400 validacion` si falta. Deja por escrito en el contrato que un ticket
 * solo nace de una accion explicita del solicitante (HU-17), nunca de una
 * inferencia sobre el texto de la conversacion.
 */
export interface ConfirmarPropuestaTicketDto {
  readonly confirmacionExplicita: true;
}

/** Ticket ya creado (HU-17, HU-FE-19). */
export interface TicketDto {
  /** Identificador visible para seguimiento. Ej.: `UH-2026-001208`. */
  readonly numero: string;
  readonly propuestaId: string;
  readonly conversacionId: string;
  readonly servicio: AreaServicio;
  readonly categoria: string;
  readonly prioridad: Prioridad;
  readonly estado: EstadoIncidente;
  /** ISO 8601. */
  readonly creadoEn: string;
  /** Tiempo de primera atencion comprometido, legible. Ej.: `8 horas habiles`. */
  readonly atencionEstimada: string | null;
}

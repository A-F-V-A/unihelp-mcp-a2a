import type {
  AreaServicio,
  EstadoIncidente,
  EstadoPropuestaTicket,
  Prioridad,
} from '@unihelp/dominio';

export interface PropuestaTicket {
  readonly id: string;
  readonly conversacionId: string;
  readonly servicio: AreaServicio;
  readonly categoria: string;
  readonly prioridad: Prioridad;
  readonly resumen: string;
  readonly descripcion: string;
  readonly estado: EstadoPropuestaTicket;
  readonly creadaEn: Date;
  readonly resueltaEn: Date | null;
  readonly ticketNumero: string | null;
}

export interface Ticket {
  readonly numero: string;
  readonly propuestaId: string;
  readonly conversacionId: string;
  readonly servicio: AreaServicio;
  readonly categoria: string;
  readonly prioridad: Prioridad;
  readonly estado: EstadoIncidente;
  readonly creadoEn: Date;
  readonly atencionEstimada: string | null;
}

export interface SolicitudPropuestaTicket {
  readonly conversacionId: string;
}

/**
 * Prueba de que la creacion del ticket la pidio el solicitante con una accion
 * explicita. El tipo literal impide construirla "por inferencia" desde otro
 * origen sin que quede escrito en el codigo.
 */
export interface ConfirmacionExplicita {
  readonly propuestaId: string;
  readonly origen: 'accion-usuario';
}

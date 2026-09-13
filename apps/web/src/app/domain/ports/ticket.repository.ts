import type {
  ConfirmacionExplicita,
  PropuestaTicket,
  SolicitudPropuestaTicket,
  Ticket,
} from '../models/ticket';

/** Puerto del ciclo propuesta -> confirmacion -> ticket (HU-13 a HU-17). */
export interface TicketRepository {
  /** Arma una propuesta a partir de la conversacion. No crea ningun ticket. */
  proponerTicket(solicitud: SolicitudPropuestaTicket): Promise<PropuestaTicket>;

  /** Unica operacion que crea un ticket, y solo con confirmacion explicita. */
  confirmarTicket(confirmacion: ConfirmacionExplicita): Promise<Ticket>;

  /** Descarta la propuesta; queda cerrada y ya no puede confirmarse. */
  rechazarTicket(propuestaId: string): Promise<PropuestaTicket>;
}

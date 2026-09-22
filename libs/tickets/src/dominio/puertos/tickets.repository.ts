import type { Confirmacion, EventoAuditoria, Propuesta, Ticket, TurnoUsuario } from '../modelos';

/** Cambios admitidos sobre una propuesta ya registrada. */
export interface CambiosPropuesta {
  readonly estado: Propuesta['estado'];
  readonly resueltaEn: Date | null;
  readonly ticketNumero: string | null;
}

/**
 * Puerto del registro de tickets y de la auditoria. La unica implementacion es
 * PostgreSQL; las pruebas usan una en memoria.
 */
export interface TicketsRepository {
  /** Ejecuta `fn` en UNA transaccion. Lo que se escriba dentro se revierte si `fn` lanza. */
  transaccion<T>(fn: (repositorio: TicketsRepository) => Promise<T>): Promise<T>;

  registrarTurno(turno: TurnoUsuario): Promise<void>;
  /** Turnos de la conversacion registrados en o despues de `desde`, en orden de registro. */
  listarTurnos(conversacionId: string, desde: Date): Promise<readonly TurnoUsuario[]>;

  guardarPropuesta(propuesta: Propuesta): Promise<void>;
  obtenerPropuesta(id: string): Promise<Propuesta | null>;
  /** Igual que `obtenerPropuesta`, pero bloquea la fila hasta el fin de la transaccion. */
  bloquearPropuesta(id: string): Promise<Propuesta | null>;
  /** La mas reciente en estado pendiente; desempate por id en orden binario (RM-10). */
  ultimaPropuestaPendiente(conversacionId: string): Promise<Propuesta | null>;
  actualizarPropuesta(id: string, cambios: CambiosPropuesta): Promise<void>;

  /** Reemplaza la confirmacion anterior de la misma propuesta, si la hay. */
  guardarConfirmacion(confirmacion: Confirmacion): Promise<void>;
  obtenerConfirmacion(propuestaId: string): Promise<Confirmacion | null>;

  siguienteNumeroTicket(): Promise<number>;
  guardarTicket(ticket: Ticket): Promise<void>;
  obtenerTicketDePropuesta(propuestaId: string): Promise<Ticket | null>;

  /** Agrega un evento. El esquema de auditoria impide modificarlo o borrarlo (HU-35). */
  registrarEvento(evento: EventoAuditoria): Promise<void>;
}

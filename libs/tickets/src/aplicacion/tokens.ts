/*
 * Los puertos son interfaces y no existen en runtime: estos simbolos son lo que
 * se inyecta. Solo `TicketsModule` los enlaza.
 */

export const TICKETS_REPOSITORY = Symbol('TICKETS_REPOSITORY');
export const RELOJ_TICKETS = Symbol('RELOJ_TICKETS');

/** Hora de pared para vencimientos y registros. Se inyecta para poder probar el vencimiento (RN-08). */
export interface RelojTickets {
  ahora(): Date;
}

/** Quien pide la operacion y en que ejecucion. */
export interface ContextoOperacion {
  readonly traceId: string;
  /** Ej.: `b0-agent`, `usuario-interfaz`. Va al registro de auditoria. */
  readonly actor: string;
}

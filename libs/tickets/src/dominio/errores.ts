/**
 * Errores de negocio del registro de tickets. Los codigos son los de docs/02,
 * seccion 5, para que el error de una herramienta sea el mismo en B0 y en B1.
 */

export const CODIGOS_ERROR_TICKETS = [
  'VALIDACION_ENTRADA',
  'RECURSO_NO_ENCONTRADO',
  'CONFIRMACION_REQUERIDA',
  'PROPUESTA_EXPIRADA',
  'PROPUESTA_INCOMPLETA',
  'PROPUESTA_RESUELTA',
] as const;

export type CodigoErrorTickets = (typeof CODIGOS_ERROR_TICKETS)[number];

/** Base de los errores de la libreria. El mensaje es apto para mostrarse a la persona (RM-11). */
export class ErrorTickets extends Error {
  constructor(
    readonly codigo: CodigoErrorTickets,
    mensaje: string,
    readonly detalles: Readonly<Record<string, string | number>> = {},
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export function esErrorTickets(valor: unknown): valor is ErrorTickets {
  return valor instanceof ErrorTickets;
}

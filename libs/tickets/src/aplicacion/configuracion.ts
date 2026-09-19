import { ErrorTickets } from '../dominio/errores';

/** Variables de entorno que lee la libreria. */
export const VARIABLES_TICKETS = {
  urlBaseDatos: 'TICKETS_DATABASE_URL',
} as const;

export interface OpcionesTickets {
  readonly urlBaseDatos?: string;
}

/** Falla al arrancar en vez de funcionar sin donde registrar tickets ni auditoria. */
export function resolverUrlTickets(
  opciones: OpcionesTickets,
  entorno: Readonly<Record<string, string | undefined>>,
): string {
  const url = opciones.urlBaseDatos ?? entorno[VARIABLES_TICKETS.urlBaseDatos];
  if (url === undefined || url.trim() === '') {
    throw new ErrorTickets(
      'VALIDACION_ENTRADA',
      `Falta ${VARIABLES_TICKETS.urlBaseDatos}: la URL de PostgreSQL de tickets y auditoría.`,
    );
  }
  return url;
}

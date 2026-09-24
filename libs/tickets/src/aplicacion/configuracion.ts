import { ErrorTickets } from '../dominio/errores';

/** Variables de entorno que lee la libreria. */
export const VARIABLES_TICKETS = {
  urlBaseDatos: 'TICKETS_DATABASE_URL',
  perfil: 'UNIHELP_PERFIL',
  entornoNode: 'NODE_ENV',
} as const;

/** Perfil que habilita vaciar el esquema `tickets` entre ejecuciones (decision 31). */
export const PERFIL_EXPERIMENTO = 'experimento';

/** Perfil que lo prohibe siempre, aunque otra variable diga lo contrario. */
export const PERFIL_PRODUCCION = 'produccion';

/**
 * Misma regla que `perfilPermiteRestablecer` de `@unihelp/conocimiento`, repetida
 * aqui a proposito: `libs/tickets` no depende de `libs/conocimiento` y una
 * garantia de escritura no se importa de otra libreria para ahorrar cinco lineas.
 */
export function perfilPermiteVaciarTickets(
  entorno: Readonly<Record<string, string | undefined>>,
): boolean {
  const perfil = entorno[VARIABLES_TICKETS.perfil];
  if (perfil === PERFIL_PRODUCCION) {
    return false;
  }
  return perfil === PERFIL_EXPERIMENTO || entorno[VARIABLES_TICKETS.entornoNode] === 'test';
}

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

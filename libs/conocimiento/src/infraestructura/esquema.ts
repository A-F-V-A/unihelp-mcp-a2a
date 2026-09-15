import { TABLAS_CONOCIMIENTO } from '../dominio/grafo';

/** Esquema de PostgreSQL propio: los tickets y la auditoria viviran en otros y el restablecimiento no los toca. */
export const ESQUEMA_CONOCIMIENTO = 'conocimiento';

/**
 * Configuracion de texto completo: `spanish` con `unaccent` antes del stemmer,
 * para que `matricula` y `matrícula` produzcan el mismo lexema.
 */
export const CONFIGURACION_TEXTO = `${ESQUEMA_CONOCIMIENTO}.espanol`;

/** Tabla de control de migraciones de esta libreria. */
export const TABLA_MIGRACIONES = 'conocimiento_migraciones';

/** Todas las tablas con esquema, para `TRUNCATE` y `LOCK` en una sola sentencia. */
export const TABLAS_CALIFICADAS = TABLAS_CONOCIMIENTO.map(
  (t) => `${ESQUEMA_CONOCIMIENTO}.${t}`,
).join(', ');

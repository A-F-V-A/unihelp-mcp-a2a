/*
 * Los puertos y la configuracion son interfaces y no existen en runtime: estos
 * simbolos son lo que se inyecta. Solo `ConocimientoModule` los enlaza.
 */

export const CONOCIMIENTO_REPOSITORY = Symbol('CONOCIMIENTO_REPOSITORY');
export const CONFIGURACION_CONOCIMIENTO = Symbol('CONFIGURACION_CONOCIMIENTO');
export const SEMILLA_CONOCIMIENTO = Symbol('SEMILLA_CONOCIMIENTO');

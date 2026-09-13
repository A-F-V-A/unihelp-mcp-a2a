/**
 * Vocabulario del flujo conversacional de triaje: como se clasifica una
 * solicitud, en que estado puede estar un servicio y que ciclo sigue una
 * propuesta de ticket. Igual que el resto de la libreria, solo tipos y
 * constantes: la decision de COMO clasificar vive en cada arquitectura.
 */

/** Como entendio el sistema la solicitud (HU-02, HU-03). */
export const TIPOS_CLASIFICACION = [
  'informativa',
  'diagnostico',
  'compuesta',
  'fuera-de-alcance',
] as const;

export type TipoClasificacion = (typeof TIPOS_CLASIFICACION)[number];

/** Estado operativo reportado para un servicio (HU-09, HU-10, HU-12). */
export const NIVELES_ESTADO_SERVICIO = [
  'operativo',
  'degradado',
  'interrumpido',
  'mantenimiento',
] as const;

export type NivelEstadoServicio = (typeof NIVELES_ESTADO_SERVICIO)[number];

/** Ciclo de vida de una propuesta de ticket antes de existir como incidente (HU-13 a HU-17). */
export const ESTADOS_PROPUESTA_TICKET = ['pendiente', 'confirmada', 'rechazada'] as const;

export type EstadoPropuestaTicket = (typeof ESTADOS_PROPUESTA_TICKET)[number];

/** Medio por el que se atiende una solicitud que UniHelp no cubre. */
export const TIPOS_CANAL_ATENCION = ['web', 'correo', 'telefono', 'presencial'] as const;

export type TipoCanalAtencion = (typeof TIPOS_CANAL_ATENCION)[number];

/** Limites del texto libre de una solicitud, en caracteres. */
export const LONGITUD_SOLICITUD = { minima: 10, maxima: 2000 } as const;

/** Maximo de politicas que se citan en una misma respuesta. */
export const MAXIMO_POLITICAS_POR_RESPUESTA = 3;

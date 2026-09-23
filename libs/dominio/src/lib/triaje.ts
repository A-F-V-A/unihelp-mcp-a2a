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

/**
 * El mismo estado, escrito como lo publican las herramientas y el simulador de
 * sistemas (docs/02) y como lo declara `estado_inicial.servicios` de las tareas
 * de `docs/tasks`. `interrumpido` se publica como `FUERA_DE_SERVICIO`
 * (decision 16): el vocabulario interno y el publicado no coinciden y la
 * traduccion vive en un solo sitio para que las cuatro arquitecturas y el
 * simulador digan exactamente lo mismo.
 */
export const ESTADOS_SERVICIO_PUBLICADOS = [
  'OPERATIVO',
  'DEGRADADO',
  'FUERA_DE_SERVICIO',
  'MANTENIMIENTO',
] as const;

export type EstadoServicioPublicado = (typeof ESTADOS_SERVICIO_PUBLICADOS)[number];

/** Traduccion del nivel interno al estado publicado. */
export const ESTADO_SERVICIO_PUBLICADO: Readonly<
  Record<NivelEstadoServicio, EstadoServicioPublicado>
> = {
  operativo: 'OPERATIVO',
  degradado: 'DEGRADADO',
  interrumpido: 'FUERA_DE_SERVICIO',
  mantenimiento: 'MANTENIMIENTO',
};

/**
 * A quien afecta una incidencia (docs/10, seccion 4). `programado` es el alcance
 * de un mantenimiento; `individual` no existe aqui porque no es un estado que el
 * servicio publique sino una conclusion del diagnostico.
 */
export const ALCANCES_AFECTACION = ['total', 'parcial', 'programado'] as const;

export type AlcanceAfectacion = (typeof ALCANCES_AFECTACION)[number];

/**
 * Nivel de servicio comprometido. Lo usa la tabla institucional de prioridad
 * (docs/10, seccion 5): la misma afectacion pesa distinto en un servicio critico.
 */
export const NIVELES_SERVICIO = ['critico', 'alto', 'medio'] as const;

export type NivelServicio = (typeof NIVELES_SERVICIO)[number];

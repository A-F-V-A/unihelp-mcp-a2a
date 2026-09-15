/**
 * Forma de la busqueda de politicas (HU-05 a HU-08). La busqueda es lexica y
 * determinista: nunca usa embeddings ni similitud vectorial (decision 17).
 */

/** Limites del texto de una consulta, en caracteres; los mismos del esquema de `buscar_politica` (docs/02). */
export const LONGITUD_CONSULTA_POLITICAS = { minima: 3, maxima: 300 } as const;

/** Lo que pide quien busca. Los filtros son codigos de servicio y de categoria. */
export interface ConsultaPoliticas {
  readonly texto: string;
  readonly servicio?: string | null;
  readonly categoria?: string | null;
}

/** Extracto que sustenta la cita, con su posicion exacta en la version citada (HU-05). */
export interface ExtractoCitado {
  readonly ordinal: number;
  /** Punto de codigo Unicode, base 0. */
  readonly inicio: number;
  /** Exclusivo. */
  readonly fin: number;
  readonly texto: string;
}

/** Una politica que supero el umbral, siempre en su version vigente. */
export interface PoliticaEncontrada {
  readonly codigo: string;
  readonly version: string;
  readonly titulo: string;
  readonly alcance: string;
  readonly categorias: readonly string[];
  readonly servicios: readonly string[];
  /** En [0, 1), redondeada a 6 decimales para que los empates sean exactos. */
  readonly relevancia: number;
  readonly extracto: ExtractoCitado;
}

/**
 * Por que una busqueda no devolvio politicas (HU-07):
 * - `consulta-sin-terminos`: tras normalizar solo quedaron palabras vacias.
 * - `sin-coincidencias`: ninguna politica vigente comparte un termino.
 * - `bajo-umbral`: hubo coincidencias, pero ninguna alcanza el umbral.
 */
export const MOTIVOS_SIN_RESULTADOS = [
  'consulta-sin-terminos',
  'sin-coincidencias',
  'bajo-umbral',
] as const;

export type MotivoSinResultados = (typeof MOTIVOS_SIN_RESULTADOS)[number];

/** Entre 1 y 3 politicas ordenadas por relevancia descendente y codigo ascendente (HU-05, HU-06). */
export interface BusquedaConResultados {
  readonly tipo: 'encontradas';
  /** Consulta lexica efectivamente ejecutada. Ej.: `'cancel' | 'semestr'`. */
  readonly consultaNormalizada: string;
  readonly umbral: number;
  readonly politicas: readonly PoliticaEncontrada[];
}

/** Ausencia declarada: nunca se sustituye por la politica mas parecida (HU-07). */
export interface BusquedaSinResultados {
  readonly tipo: 'sin-resultados';
  readonly consultaNormalizada: string;
  readonly umbral: number;
  readonly motivo: MotivoSinResultados;
}

export type ResultadoBusquedaPoliticas = BusquedaConResultados | BusquedaSinResultados;

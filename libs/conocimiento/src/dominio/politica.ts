/**
 * De donde sale una politica de la semilla. Deja trazable que parte del corpus
 * viene de `docs/10` y que parte se agrego (decision 18).
 * - `conjunto-de-tareas`: titulo y texto literal de docs/10, seccion 3.
 * - `complemento-hu-kb-04`: distractora agregada para tener cuatro por objetivo.
 * - `redactada-desde-tareas`: listada en docs/10 sin texto; redactada a partir de su tarea.
 */
export const ORIGENES_POLITICA = [
  'conjunto-de-tareas',
  'complemento-hu-kb-04',
  'redactada-desde-tareas',
] as const;

export type OrigenPolitica = (typeof ORIGENES_POLITICA)[number];

/**
 * Politica institucional como documento versionado (HU-05). El contenido no vive
 * en la politica sino en cada version, porque una cita siempre es de una version
 * concreta.
 */
export interface Politica {
  /** Ej.: `POL-AV-002`. */
  readonly codigo: string;
  /** A quien o a que situacion aplica. Es lo que distingue a dos politicas con vocabulario parecido. */
  readonly alcance: string;
  readonly dependenciaResponsable: string;
  /** Enlace al documento publicado; siempre en un dominio reservado (`.example`). */
  readonly enlace: string | null;
  /**
   * Lleva una instruccion incrustada para las tareas de inyeccion indirecta. Solo
   * entra al corpus cuando se restablece con corpus `adversarial` (docs/01, 4.3).
   */
  readonly adversarial: boolean;
  readonly origen: OrigenPolitica;
}

/** Version de una politica. Exactamente una version por politica esta vigente. */
export interface VersionPolitica {
  readonly politicaCodigo: string;
  /** `mayor.menor`. Ej.: `1.1`. */
  readonly version: string;
  readonly titulo: string;
  /** Fecha civil `YYYY-MM-DD`, sin zona horaria: no representa un instante. */
  readonly vigenteDesde: string;
  /**
   * Marca explicita, no derivada de la fecha actual: si dependiera del reloj,
   * la misma consulta podria devolver otra version segun el dia (HU-08).
   */
  readonly vigente: boolean;
  /** Texto completo: los extractos unidos por `\n`, en orden de ordinal. */
  readonly contenido: string;
}

/**
 * Fragmento citable de una version, con su posicion exacta en `contenido` (HU-05).
 *
 * Las posiciones se cuentan en puntos de codigo Unicode, base 0, con `fin`
 * exclusivo. Equivalen a `substr(contenido, inicio + 1, fin - inicio)` en
 * PostgreSQL y a `[...contenido].slice(inicio, fin).join('')` en TypeScript.
 */
export interface Extracto {
  readonly politicaCodigo: string;
  readonly version: string;
  /** Numeral dentro de la version, desde 1. */
  readonly ordinal: number;
  readonly inicio: number;
  readonly fin: number;
  readonly texto: string;
}

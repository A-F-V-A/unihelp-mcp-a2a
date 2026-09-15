/**
 * Validacion de trazas contra `experiment/schemas/traza.schema.json` (HU-MET-01).
 *
 * VALIDA, no calcula: ninguna metrica se calcula en TypeScript (decision 19). Las
 * comprobaciones aritmeticas de instrumentacion (residuo de orquestacion) viven en
 * `experiment/analisis/carga.py`.
 */
import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ESQUEMA_TRAZA } from './esquema-traza.generado';
import type { TrazaEjecucion } from './traza.generado';

/** Version del esquema que este validador aplica; coincide con `version_esquema`. */
export const VERSION_ESQUEMA_TRAZA: TrazaEjecucion['version_esquema'] = '1.0.0';

/** Un incumplimiento del esquema, con la ruta JSON Pointer del valor que falla. */
export interface ErrorValidacionTraza {
  /** Ej.: `/usage/input_tokens`. `/` si falla la raiz. */
  readonly ruta: string;
  /** Palabra clave del esquema que fallo (`required`, `minimum`, `enum`...). */
  readonly palabraClave: string;
  readonly mensaje: string;
}

/** Resultado de validar: la traza tipada o la lista completa de errores. */
export type ResultadoValidacionTraza =
  | { readonly valida: true; readonly traza: TrazaEjecucion }
  | { readonly valida: false; readonly errores: readonly ErrorValidacionTraza[] };

function traducir(error: ErrorObject): ErrorValidacionTraza {
  return {
    ruta: error.instancePath === '' ? '/' : error.instancePath,
    palabraClave: error.keyword,
    mensaje: `${error.message ?? 'no valida'} ${JSON.stringify(error.params)}`,
  };
}

/** Compila el esquema una vez y valida cualquier valor candidato a traza. */
export class ValidadorTrazas {
  private readonly validarEsquema: ValidateFunction<TrazaEjecucion>;

  constructor() {
    // `strict` hace fallar la compilacion ante un esquema ambiguo; `allErrors` reporta todo junto.
    const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
    addFormats(ajv);
    this.validarEsquema = ajv.compile<TrazaEjecucion>(ESQUEMA_TRAZA);
  }

  /** Valida sin lanzar excepciones. No modifica el candidato. */
  validar(candidata: unknown): ResultadoValidacionTraza {
    if (this.validarEsquema(candidata)) {
      return { valida: true, traza: candidata };
    }
    return { valida: false, errores: (this.validarEsquema.errors ?? []).map(traducir) };
  }
}

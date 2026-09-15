/**
 * Persistencia de trazas: valida ANTES de escribir (docs/05, paso 7).
 *
 * Una traza valida se agrega a `trazas.jsonl` con fsync. Una invalida NUNCA toca el
 * conjunto oficial: se aparta en `cuarentena/` dentro de un sobre que marca la
 * ejecucion con status `esquema_invalido`. El analisis cuenta esos sobres como
 * intentos fallidos al calcular la completitud de trazas (M7.1).
 */
import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import type { TrazaEjecucion } from './traza.generado';
import { VERSION_ESQUEMA_TRAZA, ValidadorTrazas } from './validador-trazas';
import type { ErrorValidacionTraza } from './validador-trazas';

/** Archivo del conjunto oficial dentro del directorio de la corrida. */
export const ARCHIVO_TRAZAS = 'trazas.jsonl';

/** Directorio de trazas apartadas dentro del directorio de la corrida. */
export const DIRECTORIO_CUARENTENA = 'cuarentena';

/** Configuracion del persistidor. */
export interface OpcionesPersistidorTrazas {
  /** Directorio de la corrida (ej.: `runs/2026-10-14-oficial`). */
  readonly directorioCorrida: string;
}

/** Contenido de cada archivo de cuarentena. Lo lee `experiment/analisis/carga.py`. */
export interface SobreCuarentena {
  readonly status: 'esquema_invalido';
  readonly version_esquema_esperada: string;
  readonly run_id: string | null;
  readonly errores: readonly ErrorValidacionTraza[];
  /** El candidato tal como llego, sin corregir. */
  readonly traza: unknown;
}

/** Que paso con una traza candidata. */
export type ResultadoPersistencia =
  | { readonly estado: 'persistida'; readonly archivo: string; readonly traza: TrazaEjecucion }
  | {
      readonly estado: 'esquema_invalido';
      readonly archivoCuarentena: string;
      readonly errores: readonly ErrorValidacionTraza[];
    };

function escribirConFsync(ruta: string, contenido: string, bandera: 'a' | 'w'): void {
  const descriptor = openSync(ruta, bandera);
  try {
    writeSync(descriptor, contenido);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function runIdDe(candidata: unknown): string | null {
  if (typeof candidata !== 'object' || candidata === null || !('run_id' in candidata)) {
    return null;
  }
  const valor = (candidata as { readonly run_id: unknown }).run_id;
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

/** El run_id lleva `|` y `:`, invalidos en nombres de archivo de Windows. */
function nombreArchivoCuarentena(candidata: unknown): string {
  const runId = runIdDe(candidata);
  const base = runId === null ? 'sin-run-id' : runId.replace(/[^A-Za-z0-9._-]/g, '_');
  // El sufijo por contenido evita que dos candidatos distintos con el mismo run_id se pisen.
  const huella = createHash('sha256')
    .update(JSON.stringify(candidata) ?? 'undefined')
    .digest('hex')
    .slice(0, 12);
  return `${base}-${huella}.json`;
}

/** Valida y persiste trazas de UNA corrida. */
export class PersistidorTrazas {
  constructor(
    private readonly opciones: OpcionesPersistidorTrazas,
    private readonly validador: ValidadorTrazas = new ValidadorTrazas(),
  ) {}

  /** Persiste la traza si valida; si no, la aparta en cuarentena. Nunca lanza por esquema. */
  persistir(candidata: unknown): ResultadoPersistencia {
    const resultado = this.validador.validar(candidata);
    if (resultado.valida) {
      mkdirSync(this.opciones.directorioCorrida, { recursive: true });
      const archivo = join(this.opciones.directorioCorrida, ARCHIVO_TRAZAS);
      escribirConFsync(archivo, `${JSON.stringify(resultado.traza)}\n`, 'a');
      return { estado: 'persistida', archivo, traza: resultado.traza };
    }

    const directorio = join(this.opciones.directorioCorrida, DIRECTORIO_CUARENTENA);
    mkdirSync(directorio, { recursive: true });
    const sobre: SobreCuarentena = {
      status: 'esquema_invalido',
      version_esquema_esperada: VERSION_ESQUEMA_TRAZA,
      run_id: runIdDe(candidata),
      errores: resultado.errores,
      traza: candidata ?? null,
    };
    const archivoCuarentena = join(directorio, nombreArchivoCuarentena(candidata));
    escribirConFsync(archivoCuarentena, `${JSON.stringify(sobre, null, 2)}\n`, 'w');
    return { estado: 'esquema_invalido', archivoCuarentena, errores: resultado.errores };
  }
}

import type { IdentificadorArquitectura } from '@unihelp/dominio';
import { MODOS_LLM, type ModoLlm } from '../../models/experimento/corrida';
import { CATEGORIAS_TAREA, type TareaEvaluacion } from '../../models/experimento/tarea-evaluacion';

/**
 * Lo que la persona elige en "Preparar corrida". El panel NO lanza la corrida
 * (HU-MET-14): arma la linea de comandos exacta del ejecutor para que se copie
 * y se ejecute en una terminal. Asi la configuracion que viaja a `config_hash`
 * sigue siendo `corrida.yaml` mas las anulaciones visibles en el comando.
 */
export interface SeleccionCorrida {
  readonly arquitecturas: readonly IdentificadorArquitectura[];
  /** `null` = todas las tareas (no se pasa `--tareas`). */
  readonly tareas: readonly string[] | null;
  /** `null` = la de `corrida.yaml`. */
  readonly repeticiones: number | null;
  readonly modoLlm: ModoLlm | null;
  readonly nombre: string | null;
}

export type ValidacionSeleccion =
  | { readonly valida: true; readonly seleccion: SeleccionCorrida }
  | { readonly valida: false; readonly mensaje: string };

/** Mismo criterio que `corrida.py`: un directorio, sin barras ni espacios. */
const PATRON_NOMBRE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

const ABREVIATURA_CATEGORIA: Readonly<Record<string, string>> = {
  informativa: 'INF',
  diagnostico: 'DIA',
  compuesta: 'COM',
  adversarial: 'ADV',
};

export function validarSeleccionCorrida(seleccion: SeleccionCorrida): ValidacionSeleccion {
  if (seleccion.arquitecturas.length === 0) {
    return { valida: false, mensaje: 'Elige al menos una arquitectura.' };
  }
  if (seleccion.tareas !== null && seleccion.tareas.length === 0) {
    return { valida: false, mensaje: 'Elige al menos una tarea o marca todas.' };
  }
  if (
    seleccion.repeticiones !== null &&
    (!Number.isInteger(seleccion.repeticiones) || seleccion.repeticiones < 1)
  ) {
    return { valida: false, mensaje: 'Las repeticiones deben ser un entero mayor o igual a 1.' };
  }
  if (seleccion.modoLlm !== null && !(MODOS_LLM as readonly string[]).includes(seleccion.modoLlm)) {
    return { valida: false, mensaje: 'El modo del modelo debe ser live, record o replay.' };
  }
  const nombre = seleccion.nombre?.trim() || null;
  if (nombre !== null && !PATRON_NOMBRE.test(nombre)) {
    return {
      valida: false,
      mensaje: 'El nombre de la corrida solo admite letras, numeros, punto, guion y guion bajo.',
    };
  }
  return { valida: true, seleccion: { ...seleccion, nombre } };
}

/**
 * Reduce una lista de ids al patron mas corto que el ejecutor entiende: si
 * estan todas las tareas de una categoria, `T-COM-*`; si estan todas, `null`.
 * El orden de salida es por id, para que el comando sea el mismo sin importar
 * en que orden se marcaron (RM-10).
 */
export function compactarTareas(
  seleccionadas: readonly string[],
  todas: readonly TareaEvaluacion[],
): readonly string[] | null {
  const marcadas = new Set(seleccionadas);
  if (todas.length > 0 && todas.every((tarea) => marcadas.has(tarea.id))) {
    return null;
  }
  const patrones: string[] = [];
  const sueltas = new Set(marcadas);
  for (const categoria of CATEGORIAS_TAREA) {
    const deCategoria = todas.filter((tarea) => tarea.categoria === categoria);
    if (deCategoria.length > 0 && deCategoria.every((tarea) => marcadas.has(tarea.id))) {
      patrones.push(`T-${ABREVIATURA_CATEGORIA[categoria]}-*`);
      deCategoria.forEach((tarea) => sueltas.delete(tarea.id));
    }
  }
  return [...patrones, ...[...sueltas].sort()];
}

/**
 * Linea de comandos para la raiz del repositorio. `pnpm ejecutor:correr` reenvia
 * los argumentos a `uv run python -m ejecutor correr` (project.json de
 * `analisis`), asi que las opciones son las de `experiment/ejecutor/cli.py`.
 */
export function construirComandoCorrida(seleccion: SeleccionCorrida): string {
  const partes = [
    'pnpm ejecutor:correr --',
    `--arquitecturas ${seleccion.arquitecturas.join(',')}`,
  ];
  if (seleccion.tareas !== null) {
    partes.push(`--tareas ${seleccion.tareas.join(',')}`);
  }
  if (seleccion.repeticiones !== null) {
    partes.push(`--repeticiones ${seleccion.repeticiones}`);
  }
  if (seleccion.modoLlm !== null) {
    partes.push(`--modo-llm ${seleccion.modoLlm}`);
  }
  if (seleccion.nombre) {
    partes.push(`--nombre ${seleccion.nombre}`);
  }
  return partes.join(' ');
}

/** Comandos que hay que haber corrido antes, en el orden del README de experiment/. */
export const PASOS_PREVIOS_CORRIDA: readonly string[] = [
  'pnpm conocimiento:db',
  'pnpm conocimiento:migrar && pnpm tickets:migrar',
  'pnpm dev:b0   # con UNIHELP_PERFIL=experimento en el .env del backend',
  'pnpm ejecutor:validar',
  'pnpm ejecutor:salud',
];

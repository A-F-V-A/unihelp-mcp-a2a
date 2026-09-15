/*
 * Utilidades SOLO para pruebas: leen los ejemplos de experiment/schemas/ejemplos,
 * que Python (jsonschema) y TypeScript (AJV) deben juzgar igual.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const DIRECTORIO_EJEMPLOS = resolve(__dirname, '../../../../experiment/schemas/ejemplos');

export interface OperacionCaso {
  readonly eliminar?: string;
  readonly asignar?: string;
  readonly valor?: unknown;
}

export interface CasoValidacion {
  readonly nombre: string;
  readonly operaciones: readonly OperacionCaso[];
  readonly valida: boolean;
}

interface ArchivoCasos {
  readonly base: string;
  readonly casos: readonly CasoValidacion[];
}

function leerJson<T>(nombre: string): T {
  return JSON.parse(readFileSync(resolve(DIRECTORIO_EJEMPLOS, nombre), 'utf8')) as T;
}

export function leerTrazaValida(): Record<string, unknown> {
  return leerJson<Record<string, unknown>>('traza-valida.json');
}

export function leerCasos(): readonly CasoValidacion[] {
  return leerJson<ArchivoCasos>('casos-validacion-traza.json').casos;
}

/** Aplica las operaciones sobre una copia de la traza base. */
export function construirCaso(caso: CasoValidacion): Record<string, unknown> {
  const documento = leerTrazaValida();
  for (const operacion of caso.operaciones) {
    const segmentos = (operacion.eliminar ?? operacion.asignar ?? '').split('.');
    const ultimo = segmentos.pop() as string;
    let nodo: unknown = documento;
    for (const segmento of segmentos) {
      nodo = (nodo as Record<string, unknown>)[segmento];
    }
    const contenedor = nodo as Record<string, unknown>;
    if (operacion.eliminar !== undefined) {
      delete contenedor[ultimo];
    } else {
      contenedor[ultimo] = operacion.valor;
    }
  }
  return documento;
}

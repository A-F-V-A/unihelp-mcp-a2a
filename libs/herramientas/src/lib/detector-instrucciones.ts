/**
 * Detector de instrucciones incrustadas en contenido recuperado (capa 3 de la
 * defensa ante inyeccion; HU-18, criterio 2). Es una HEURISTICA determinista:
 * reduce la probabilidad de que el modelo obedezca el contenido hostil, no la
 * elimina. La garantia real es el token de confirmacion (HU-16).
 */

/** Version de la lista de patrones. Cambiarla cambia lo que ve el modelo: se versiona. */
export const VERSION_PATRONES_INSTRUCCIONES = '1.0.0';

const PATRONES: readonly RegExp[] = [
  /\bignora\b.{0,40}\b(regla|instruccion|indicacion)/,
  /\bolvida\b.{0,30}\b(regla|instruccion|indicacion)/,
  /\binstruccion(es)? (prioritaria|para el (asistente|agente|sistema|modelo))/,
  /\b(asistente|agente) (automatico|coordinador)\b/,
  /\bsin (solicitar|pedir) (la )?confirmacion\b/,
  /\bno (pidas|solicites|pedir) confirmacion\b/,
  /\b(crea|registra|genera) de inmediato\b/,
  /\bprompt del sistema\b|\bsystem prompt\b/,
  /\bya fue autorizad[oa]\b/,
];

export interface ResultadoDeteccion {
  readonly sospechoso: boolean;
  /** Oraciones del texto original que activaron algun patron. */
  readonly fragmentos: readonly string[];
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Marca, sin modificar el contenido, las oraciones que parecen ordenes dirigidas al sistema. */
export function detectarInstruccionesIncrustadas(texto: string): ResultadoDeteccion {
  const oraciones = texto.split(/(?<=[.!?:])\s+/);
  const fragmentos = oraciones.filter((oracion) =>
    PATRONES.some((patron) => patron.test(normalizar(oracion))),
  );
  return { sospechoso: fragmentos.length > 0, fragmentos };
}

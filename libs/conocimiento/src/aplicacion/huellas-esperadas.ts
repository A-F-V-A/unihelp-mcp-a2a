import { CORPUS_CONOCIMIENTO } from '../dominio/grafo';
import type { CorpusConocimiento } from '../dominio/grafo';
import { compararTexto } from '../dominio/reglas/estado-canonico.rules';
import { construirEstadoConocimiento } from '../dominio/reglas/semilla.rules';
import type { SemillaConocimiento } from '../dominio/semilla';
import { calcularHuella } from './huella';

export interface HuellaEsperada {
  readonly estadoInicial: string;
  readonly corpus: CorpusConocimiento;
  readonly huella: string;
}

/**
 * Huella de cada combinacion de estado inicial y corpus, calculada sin base de
 * datos. Es la tabla contra la que el ejecutor compara antes de cada ejecucion:
 * si la huella devuelta por el restablecimiento no coincide, la ejecucion se
 * aborta (HU-36, M7.2). Ordenada por estado inicial (orden binario) y corpus.
 */
export function calcularHuellasEsperadas(semilla: SemillaConocimiento): readonly HuellaEsperada[] {
  return [...semilla.estadosIniciales]
    .map((e) => e.codigo)
    .sort(compararTexto)
    .flatMap((estadoInicial) =>
      CORPUS_CONOCIMIENTO.map((corpus) => ({
        estadoInicial,
        corpus,
        huella: calcularHuella(construirEstadoConocimiento(semilla, { estadoInicial, corpus })),
      })),
    );
}

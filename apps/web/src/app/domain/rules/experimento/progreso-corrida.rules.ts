import type { IdentificadorArquitectura } from '@unihelp/dominio';
import { esIdentificadorArquitectura } from '@unihelp/dominio';
import type { LineaTrabajo } from '../../models/experimento/trabajo-consola';

/**
 * Lee el progreso de una corrida en la salida del ejecutor. Los renglones que
 * interpreta son los de `experiment/ejecutor/corrida.py`:
 *
 *   Corrida en <directorio> (<version>)
 *   <n> ejecuciones; modo <modo>
 *     3/40 OK T-COM-001 B0 r1 ok
 *     4/40 -- T-ADV-004 B0 r1 ok [herramienta_prohibida:proponer_ticket]
 *
 * Es lectura de lo que el ejecutor ya decidio: aqui no se puntua nada (RM-02).
 */

export interface EjecucionEnCurso {
  readonly indice: number;
  readonly total: number;
  /** `OK` del ejecutor: supero la compuerta automatica. */
  readonly aprobada: boolean;
  readonly tareaId: string;
  readonly arquitectura: IdentificadorArquitectura;
  readonly repeticion: number;
  /** Estado final o `cuarentena`. */
  readonly detalle: string;
  readonly motivos: readonly string[];
}

export interface ProgresoCorrida {
  readonly corrida: string | null;
  readonly total: number | null;
  readonly ejecuciones: readonly EjecucionEnCurso[];
  readonly resumen: string | null;
}

const PATRON_EJECUCION =
  /^\s*(\d+)\/(\d+) (OK|--) (T-[A-Z]{3}-\d{3}) (B\d) r(\d+) (\S+)(?: \[(.*)\])?\s*$/;
const PATRON_CORRIDA = /^Corrida en (.+?) \(/;
const PATRON_TOTAL = /^(\d+) ejecuciones; modo /;
const PATRON_RESUMEN =
  /^\d+ ejecuciones; \d+ trazas validas; \d+ superaron la compuerta automatica\.$/;

export function leerProgreso(lineas: readonly LineaTrabajo[]): ProgresoCorrida {
  let corrida: string | null = null;
  let total: number | null = null;
  let resumen: string | null = null;
  const ejecuciones: EjecucionEnCurso[] = [];
  for (const linea of lineas) {
    const texto = linea.texto;
    const marcaCorrida = PATRON_CORRIDA.exec(texto);
    if (marcaCorrida) {
      corrida = marcaCorrida[1].split(/[\\/]/).pop() ?? null;
      continue;
    }
    const marcaTotal = PATRON_TOTAL.exec(texto);
    if (marcaTotal) {
      total = Number(marcaTotal[1]);
      continue;
    }
    if (PATRON_RESUMEN.test(texto.trim())) {
      resumen = texto.trim();
      continue;
    }
    const ejecucion = PATRON_EJECUCION.exec(texto);
    if (ejecucion && esIdentificadorArquitectura(ejecucion[5])) {
      ejecuciones.push({
        indice: Number(ejecucion[1]),
        total: Number(ejecucion[2]),
        aprobada: ejecucion[3] === 'OK',
        tareaId: ejecucion[4],
        arquitectura: ejecucion[5],
        repeticion: Number(ejecucion[6]),
        detalle: ejecucion[7],
        motivos: ejecucion[8] ? ejecucion[8].split('; ').filter(Boolean) : [],
      });
    }
  }
  return { corrida, total: total ?? ejecuciones.at(-1)?.total ?? null, ejecuciones, resumen };
}

/**
 * Persistencia de lo observado y puente con la compuerta de Python.
 *
 * El visor NO arma la traza ni decide el exito: escribe una observacion por
 * ejecucion y se la pasa a `uv run python -m ejecutor puntuar-observacion`, que
 * la arma, la valida contra el esquema y aplica la compuerta con el mismo codigo
 * que el ejecutor (RM-02, RM-16). Si Python no esta disponible, el panel lo dice
 * y la prueba sigue: la observacion queda escrita para importarla despues.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ_EXPERIMENTO } from './configuracion';
import type { Observacion, VeredictoCompuerta } from './tipos';

export const ARCHIVO_OBSERVACIONES = 'observaciones.jsonl';

/** Agrega la observacion al `observaciones.jsonl` de la corrida y devuelve la ruta. */
export function escribirObservacion(directorioCorrida: string, observacion: Observacion): string {
  mkdirSync(directorioCorrida, { recursive: true });
  const ruta = resolve(directorioCorrida, ARCHIVO_OBSERVACIONES);
  appendFileSync(ruta, `${JSON.stringify(observacion)}\n`, 'utf8');
  return ruta;
}

export type ResultadoCompuerta =
  | { readonly disponible: true; readonly veredicto: VeredictoCompuerta }
  | { readonly disponible: false; readonly motivo: string };

/** Pide a Python el veredicto de UNA observacion. Nunca lanza: devuelve el motivo si no pudo. */
export function puntuarConPython(observacion: Observacion): ResultadoCompuerta {
  try {
    const salida = execFileSync(
      'uv',
      ['run', '--quiet', 'python', '-m', 'ejecutor', 'puntuar-observacion'],
      {
        cwd: RAIZ_EXPERIMENTO,
        input: JSON.stringify(observacion),
        encoding: 'utf8',
        timeout: 120_000,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const inicio = salida.indexOf('{');
    if (inicio < 0) {
      return { disponible: false, motivo: `Python no devolvio JSON: ${salida.slice(0, 200)}` };
    }
    return { disponible: true, veredicto: JSON.parse(salida.slice(inicio)) as VeredictoCompuerta };
  } catch (error) {
    const detalle =
      typeof error === 'object' && error !== null && 'stderr' in error
        ? String((error as { stderr: unknown }).stderr)
            .trim()
            .split('\n')
            .slice(-3)
            .join(' ')
        : String(error);
    return { disponible: false, motivo: detalle.slice(0, 300) || 'no se pudo ejecutar uv' };
  }
}

import { performance } from 'node:perf_hooks';

/**
 * Instante monotono en milisegundos, con decimales. TODA duracion se mide con
 * esto y nunca con la hora de pared, que puede saltar por sincronizacion (D6, RM-06).
 */
export function ahoraMonotonoMs(): number {
  return performance.now();
}

import type { MetricaResultado } from '../../models/experimento/resultados-analisis';

/**
 * Estado visual de una metrica de CONTROL (familia M7) en el semaforo del panel
 * (HU-MET-10). Solo traduce lo que el cuaderno ya decidio (`umbral.alcanza`);
 * jamas compara un valor con un umbral aqui (RM-02).
 */
export type EstadoSemaforo = 'alcanza' | 'no_alcanza' | 'sin_datos' | 'pendiente' | 'no_evaluable';

/** Una metrica de resultado abierto NUNCA entra al semaforo (HU-MET-03, RM-14). */
export function admiteSemaforo(metrica: MetricaResultado): boolean {
  return metrica.tipoValorEsperado === 'umbral' && metrica.umbral !== null;
}

export function estadoSemaforo(metrica: MetricaResultado): EstadoSemaforo | null {
  if (!admiteSemaforo(metrica) || metrica.umbral === null) {
    return null;
  }
  if (metrica.estado === 'pendiente') {
    return 'pendiente';
  }
  if (metrica.estado === 'sin_datos') {
    return 'sin_datos';
  }
  if (metrica.umbral.alcanza === null) {
    return 'no_evaluable';
  }
  return metrica.umbral.alcanza ? 'alcanza' : 'no_alcanza';
}

/** Las de control, en el orden del registro (M7.1 a M7.7). */
export function metricasDeControl(metricas: readonly MetricaResultado[]): MetricaResultado[] {
  return metricas
    .filter((metrica) => metrica.rol === 'control')
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
}

/**
 * Resumen de la fila superior del panel: cuantas metricas de control hay en
 * cada estado. Es un conteo de estados, no una metrica: sirve para la frase
 * "3 de 7 con datos", nunca para una tasa.
 */
export interface ResumenSemaforo {
  readonly total: number;
  readonly alcanzan: number;
  readonly noAlcanzan: number;
  readonly sinDatos: number;
}

export function resumirSemaforo(control: readonly MetricaResultado[]): ResumenSemaforo {
  let alcanzan = 0;
  let noAlcanzan = 0;
  let sinDatos = 0;
  for (const metrica of control) {
    const estado = estadoSemaforo(metrica);
    if (estado === 'alcanza') {
      alcanzan += 1;
    } else if (estado === 'no_alcanza') {
      noAlcanzan += 1;
    } else {
      sinDatos += 1;
    }
  }
  return { total: control.length, alcanzan, noAlcanzan, sinDatos };
}

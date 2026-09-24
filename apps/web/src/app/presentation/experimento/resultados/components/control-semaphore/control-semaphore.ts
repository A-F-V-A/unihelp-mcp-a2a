import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MetricaResultado } from '../../../../../domain/models/experimento/resultados-analisis';
import {
  type EstadoSemaforo,
  estadoSemaforo,
  metricasDeControl,
  resumirSemaforo,
} from '../../../../../domain/rules/experimento/semaforo.rules';
import { ETIQUETA_SEMAFORO, formatearDecimal } from '../../../shared/etiquetas-experimento';

interface Luz {
  readonly metrica: MetricaResultado;
  readonly estado: EstadoSemaforo;
  readonly observado: string;
}

/**
 * Semaforo de las metricas de control M7 (HU-MET-10): cada una con su umbral,
 * si lo alcanza y la consecuencia declarada en el plan cuando no. Lo que se
 * pinta es `umbral.alcanza` tal como lo dejo el cuaderno; el panel no compara.
 * Las metricas de resultado abierto no llegan aqui (RM-14).
 */
@Component({
  selector: 'app-control-semaphore',
  templateUrl: './control-semaphore.html',
  styleUrl: './control-semaphore.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlSemaphore {
  readonly metricas = input.required<readonly MetricaResultado[]>();

  protected readonly etiquetaSemaforo = ETIQUETA_SEMAFORO;

  protected readonly luces = computed<Luz[]>(() =>
    metricasDeControl(this.metricas()).map((metrica) => ({
      metrica,
      estado: estadoSemaforo(metrica) ?? 'no_evaluable',
      observado: observadoLegible(metrica),
    })),
  );

  protected readonly resumen = computed(() => resumirSemaforo(metricasDeControl(this.metricas())));
}

function observadoLegible(metrica: MetricaResultado): string {
  const observado = metrica.umbral?.observado;
  if (observado === null || observado === undefined) {
    return 'sin dato';
  }
  if (typeof observado === 'number') {
    return formatearDecimal(observado);
  }
  const partes = Object.entries(observado)
    .filter(([, valor]) => valor !== null)
    .map(([arquitectura, valor]) => `${arquitectura} ${formatearDecimal(valor)}`);
  return partes.length ? partes.join(' · ') : 'sin dato';
}

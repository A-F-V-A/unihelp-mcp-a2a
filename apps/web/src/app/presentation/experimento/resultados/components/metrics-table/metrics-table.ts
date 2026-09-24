import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import {
  FAMILIAS_METRICA,
  type FamiliaMetrica,
  type MetricaResultado,
} from '../../../../../domain/models/experimento/resultados-analisis';
import { estadoSemaforo } from '../../../../../domain/rules/experimento/semaforo.rules';
import {
  ETIQUETA_ESTADO_METRICA,
  ETIQUETA_FAMILIA,
  ETIQUETA_ROL,
  ETIQUETA_SEMAFORO,
  formatearDecimal,
  formatearIntervalo,
} from '../../../shared/etiquetas-experimento';

/**
 * Las 43 metricas del registro con su estado, y al abrir una, sus filas y
 * contrastes tal como los escribio el cuaderno. Una metrica de resultado
 * abierto muestra su valor sin ningun aprobado/reprobado (HU-MET-03); solo las
 * de umbral dicen si lo alcanzan.
 */
@Component({
  selector: 'app-metrics-table',
  templateUrl: './metrics-table.html',
  styleUrl: './metrics-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsTable {
  readonly metricas = input.required<readonly MetricaResultado[]>();

  protected readonly familias = FAMILIAS_METRICA;
  protected readonly etiquetaFamilia = ETIQUETA_FAMILIA;
  protected readonly etiquetaRol = ETIQUETA_ROL;
  protected readonly etiquetaEstado = ETIQUETA_ESTADO_METRICA;
  protected readonly etiquetaSemaforo = ETIQUETA_SEMAFORO;
  protected readonly estadoSemaforo = estadoSemaforo;
  protected readonly formatearDecimal = formatearDecimal;
  protected readonly formatearIntervalo = formatearIntervalo;

  protected readonly familia = signal<FamiliaMetrica | null>(null);
  protected readonly soloCalculadas = signal(false);
  protected readonly abierta = signal<string | null>(null);

  protected readonly visibles = computed(() =>
    this.metricas().filter(
      (m) =>
        (this.familia() === null || m.familia === this.familia()) &&
        (!this.soloCalculadas() || m.estado === 'calculada'),
    ),
  );

  protected elegirFamilia(familia: FamiliaMetrica | null): void {
    this.familia.set(familia);
  }

  protected alternarCalculadas(): void {
    this.soloCalculadas.update((v) => !v);
  }

  protected alternar(codigo: string): void {
    this.abierta.update((actual) => (actual === codigo ? null : codigo));
  }

  protected dimensiones(d: Readonly<Record<string, string>>): string {
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  }
}

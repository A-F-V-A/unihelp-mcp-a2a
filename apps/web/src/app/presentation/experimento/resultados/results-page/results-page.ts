import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExperimentoStore } from '../../../../application/state/experimento.store';
import {
  GRUPOS_EFECTIVIDAD,
  barrasLatencia,
  buscarMetrica,
  filasPorArquitectura,
  pisoTransporte,
  puntosEfectividad,
} from '../../../../domain/rules/experimento/graficas.rules';
import {
  ETIQUETA_CATEGORIA,
  ETIQUETA_FAMILIA,
  formatearFechaHora,
} from '../../shared/etiquetas-experimento';
import { EstadoRecurso } from '../../shared/estado-recurso/estado-recurso';
import { ControlSemaphore } from '../components/control-semaphore/control-semaphore';
import { DotIntervalChart } from '../components/dot-interval-chart/dot-interval-chart';
import { FiguresGallery } from '../components/figures-gallery/figures-gallery';
import { LatencyChart } from '../components/latency-chart/latency-chart';
import { MetricsTable } from '../components/metrics-table/metrics-table';

const ETIQUETAS_GRUPO: Readonly<Record<string, string>> = {
  global: 'Global (40 tareas)',
  ...ETIQUETA_CATEGORIA,
};

/**
 * Resultados del cuaderno de analisis (HU-MET-09): semaforo de control,
 * efectividad con intervalos, latencia apilada, tokens, seguridad, las 43
 * metricas y las figuras publicadas. Todo sale de `resultados.json`; si no
 * existe o su version no coincide, se declara y no se muestra nada parcial.
 */
@Component({
  selector: 'app-results-page',
  imports: [
    RouterLink,
    EstadoRecurso,
    ControlSemaphore,
    DotIntervalChart,
    LatencyChart,
    MetricsTable,
    FiguresGallery,
  ],
  templateUrl: './results-page.html',
  styleUrl: './results-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsPage {
  private readonly store = inject(ExperimentoStore);

  protected readonly recurso = this.store.resultados;
  protected readonly resultados = computed(() => this.recurso().valor?.resultados ?? null);
  protected readonly manifiesto = computed(() => this.recurso().valor?.manifiesto ?? null);
  protected readonly gruposEfectividad = GRUPOS_EFECTIVIDAD;
  protected readonly etiquetasGrupo = ETIQUETAS_GRUPO;
  protected readonly etiquetaFamilia = ETIQUETA_FAMILIA;
  protected readonly formatearFechaHora = formatearFechaHora;
  protected readonly urlSalida = (archivo: string) => this.store.urlSalida(archivo);

  protected readonly metricas = computed(() => this.resultados()?.metricas ?? []);

  protected readonly puntosEfectividad = computed(() =>
    puntosEfectividad(
      buscarMetrica(this.metricas(), 'M1.1'),
      buscarMetrica(this.metricas(), 'M1.2'),
    ),
  );

  protected readonly barrasLatencia = computed(() =>
    barrasLatencia(
      buscarMetrica(this.metricas(), 'M4.2'),
      buscarMetrica(this.metricas(), 'M4.1'),
      this.resultados()?.corrida.arquitecturas ?? [],
    ),
  );

  protected readonly pisoTransporte = computed(() =>
    pisoTransporte(buscarMetrica(this.metricas(), 'M4.3')),
  );

  protected readonly puntosTokens = computed(() =>
    filasPorArquitectura(
      buscarMetrica(this.metricas(), 'M4.6'),
      'tokens',
      'total',
      'mediana_entre_tareas',
    ).map((f) => ({
      grupo: 'total',
      arquitectura: f.arquitectura ?? 'B0',
      valor: f.valor,
      intervalo: f.intervalo,
      nTareas: f.nTareas,
    })),
  );

  protected readonly puntosLlamadas = computed(() =>
    filasPorArquitectura(
      buscarMetrica(this.metricas(), 'M4.4'),
      null,
      null,
      'mediana_entre_tareas',
    ).map((f) => ({
      grupo: 'llamadas',
      arquitectura: f.arquitectura ?? 'B0',
      valor: f.valor,
      intervalo: f.intervalo,
      nTareas: f.nTareas,
    })),
  );

  protected readonly seguridad = computed(() => this.metricas().filter((m) => m.familia === 'M5'));

  /** Arquitecturas que el archivo declara pero para las que no hay ninguna fila con valor. */
  protected readonly sinDatos = computed(() => {
    const r = this.resultados();
    if (!r) {
      return [];
    }
    const conValor = new Set(
      r.metricas.flatMap((m) => m.filas.filter((f) => f.valor !== null).map((f) => f.arquitectura)),
    );
    return r.corrida.arquitecturas.filter((a) => !conValor.has(a));
  });

  protected readonly contrastesPrimarios = computed(() =>
    ['M1.1', 'M4.1', 'M4.6']
      .map((codigo) => buscarMetrica(this.metricas(), codigo))
      .filter((m) => m !== null)
      .flatMap((m) =>
        m.contrastes
          .filter(
            (c) => Object.keys(c.dimensiones).length === 0 || c.dimensiones['tokens'] === 'total',
          )
          .map((c) => ({ metrica: m, contraste: c })),
      ),
  );

  constructor() {
    void this.store.cargarResultadosPublicados();
  }

  protected recargar(): void {
    void this.store.cargarResultadosPublicados();
  }

  protected porCategoria(categoria: string): number {
    return this.resultados()?.corrida.tareasPorCategoria[categoria] ?? 0;
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  type BarraLatencia,
  COMPONENTES_LATENCIA,
  type PisoTransporte,
} from '../../../../../domain/rules/experimento/graficas.rules';
import { descargarCsv, descargarPng, descargarSvg } from '../../../shared/descargar';
import {
  COLOR_ARQUITECTURA,
  COLOR_COMPONENTE,
  ETIQUETA_COMPONENTE,
  formatearIntervalo,
  formatearMs,
  formatearPorcentaje,
} from '../../../shared/etiquetas-experimento';
import { ChartToolbar } from '../chart-toolbar/chart-toolbar';

interface SegmentoDibujado {
  readonly etiqueta: string;
  readonly color: string;
  readonly y: number;
  readonly alto: number;
  readonly ms: number;
}

interface BarraDibujada {
  readonly barra: BarraLatencia;
  readonly x: number;
  readonly segmentos: readonly SegmentoDibujado[];
  readonly yMediana: number | null;
  readonly texto: string;
}

const ANCHO = 720;
const ALTO = 320;
const MARGEN = { arriba: 16, derecha: 16, abajo: 40, izquierda: 60 };
const ANCHO_BARRA = 24;
const HUECO = 2;

/**
 * Descomposicion de la latencia (HU-MET-12): los cuatro componentes apilados
 * (medianas de M4.2) con la mediana de extremo a extremo (M4.1) superpuesta
 * como marcador. La pila NO muestra su suma: las medianas no son aditivas
 * (nota del cuaderno). El piso de transporte (M4.3) va como referencia al lado.
 */
@Component({
  selector: 'app-latency-chart',
  imports: [ChartToolbar],
  templateUrl: './latency-chart.html',
  styleUrl: './latency-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LatencyChart {
  readonly barras = input.required<readonly BarraLatencia[]>();
  readonly piso = input<readonly PisoTransporte[]>([]);
  readonly nombreArchivo = input('latencia');

  protected readonly tablaVisible = signal(false);
  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;
  protected readonly margen = MARGEN;
  protected readonly anchoBarra = ANCHO_BARRA;
  protected readonly componentes = COMPONENTES_LATENCIA;
  protected readonly etiquetaComponente = ETIQUETA_COMPONENTE;
  protected readonly colorComponente = COLOR_COMPONENTE;
  protected readonly colorArquitectura = COLOR_ARQUITECTURA;
  protected readonly formatearMs = formatearMs;
  protected readonly formatearPorcentaje = formatearPorcentaje;
  protected readonly formatearIntervalo = formatearIntervalo;

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  protected readonly tope = computed(() => {
    const valores = this.barras().flatMap((b) => [
      b.segmentos.reduce((suma, s) => suma + (s.medianaMs ?? 0), 0),
      b.medianaTotalMs ?? 0,
      b.intervaloTotal?.superior ?? 0,
    ]);
    const mayor = Math.max(0, ...valores);
    return mayor === 0 ? 1000 : mayor * 1.12;
  });

  protected readonly marcasY = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      valor: f * this.tope(),
      y: this.escalaY(f * this.tope()),
    })),
  );

  protected readonly dibujadas = computed<BarraDibujada[]>(() => {
    const barras = this.barras();
    const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
    const paso = anchoUtil / Math.max(1, barras.length);
    return barras.map((barra, i) => {
      const x = MARGEN.izquierda + paso * (i + 0.5) - ANCHO_BARRA / 2;
      let acumulado = 0;
      const segmentos: SegmentoDibujado[] = [];
      for (const segmento of barra.segmentos) {
        const ms = segmento.medianaMs ?? 0;
        if (ms <= 0) {
          continue;
        }
        const yBase = this.escalaY(acumulado);
        const yTope = this.escalaY(acumulado + ms);
        segmentos.push({
          etiqueta: ETIQUETA_COMPONENTE[segmento.componente],
          color: COLOR_COMPONENTE[segmento.componente],
          y: yTope,
          alto: Math.max(0, yBase - yTope - HUECO),
          ms,
        });
        acumulado += ms;
      }
      const detalle = barra.segmentos
        .map((s) => `${ETIQUETA_COMPONENTE[s.componente]} ${formatearMs(s.medianaMs)}`)
        .join(', ');
      return {
        barra,
        x,
        segmentos,
        yMediana: barra.medianaTotalMs === null ? null : this.escalaY(barra.medianaTotalMs),
        texto: `${barra.arquitectura}: mediana de extremo a extremo ${formatearMs(barra.medianaTotalMs)} (${formatearIntervalo(barra.intervaloTotal, 'ms')}). Medianas por componente: ${detalle}.`,
      };
    });
  });

  protected readonly hayDatos = computed(() =>
    this.barras().some(
      (b) => b.medianaTotalMs !== null || b.segmentos.some((s) => s.medianaMs !== null),
    ),
  );

  protected alternarTabla(): void {
    this.tablaVisible.update((v) => !v);
  }

  protected exportarSvg(): void {
    const svg = this.svg()?.nativeElement;
    if (svg) {
      descargarSvg(svg, this.nombreArchivo());
    }
  }

  protected exportarPng(): void {
    const svg = this.svg()?.nativeElement;
    if (svg) {
      void descargarPng(svg, this.nombreArchivo());
    }
  }

  protected exportarCsv(): void {
    descargarCsv(
      [
        'arquitectura',
        'componente',
        'mediana_ms',
        'ic_inferior',
        'ic_superior',
        'mediana_total_ms',
        'proporcion_residuo',
      ],
      this.barras().flatMap((b) =>
        b.segmentos.map((s) => [
          b.arquitectura,
          s.componente,
          s.medianaMs,
          s.intervalo?.inferior ?? null,
          s.intervalo?.superior ?? null,
          b.medianaTotalMs,
          b.proporcionResiduo,
        ]),
      ),
      this.nombreArchivo(),
    );
  }

  private escalaY(valor: number): number {
    const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
    return MARGEN.arriba + altoUtil - (valor / this.tope()) * altoUtil;
  }
}

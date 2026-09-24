import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { IDENTIFICADORES_ARQUITECTURA, type IdentificadorArquitectura } from '@unihelp/dominio';
import type { PuntoConIntervalo } from '../../../../../domain/rules/experimento/graficas.rules';
import { descargarCsv, descargarPng, descargarSvg } from '../../../shared/descargar';
import {
  COLOR_ARQUITECTURA,
  formatearDecimal,
  formatearEntero,
  formatearIntervalo,
  formatearMs,
  formatearPorcentaje,
} from '../../../shared/etiquetas-experimento';
import { ChartToolbar } from '../chart-toolbar/chart-toolbar';

export type FormatoValor = 'porcentaje' | 'entero' | 'ms' | 'decimal';

interface PuntoDibujado {
  readonly punto: PuntoConIntervalo;
  readonly x: number;
  readonly y: number;
  readonly yInferior: number;
  readonly ySuperior: number;
  readonly color: string;
  readonly texto: string;
}

const ANCHO = 720;
const ALTO = 300;
const MARGEN = { arriba: 16, derecha: 16, abajo: 40, izquierda: 56 };
const SEPARACION_SERIES = 18;

/**
 * Punto con barra de error por arquitectura y grupo: tasa de exito con IC
 * (HU-MET-11), tokens por ejecucion (M4.6)... Solo dibuja valores e
 * intervalos que vienen calculados; un punto sin valor no se pinta y la tabla
 * lo declara "sin datos". El eje empieza en cero siempre.
 */
@Component({
  selector: 'app-dot-interval-chart',
  imports: [ChartToolbar],
  templateUrl: './dot-interval-chart.html',
  styleUrl: './dot-interval-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DotIntervalChart {
  readonly titulo = input.required<string>();
  readonly puntos = input.required<readonly PuntoConIntervalo[]>();
  /** Orden de los grupos del eje X y su etiqueta visible. */
  readonly grupos = input.required<readonly string[]>();
  readonly etiquetasGrupo = input<Readonly<Record<string, string>>>({});
  readonly formato = input<FormatoValor>('decimal');
  /** Tope fijo del eje (1 para proporciones); `null` = el mayor intervalo. */
  readonly maximo = input<number | null>(null);
  readonly nombreArchivo = input('grafica');
  readonly etiquetaEje = input('');

  protected readonly tablaVisible = signal(false);
  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;
  protected readonly margen = MARGEN;
  protected readonly arquitecturas = IDENTIFICADORES_ARQUITECTURA;
  protected readonly colores = COLOR_ARQUITECTURA;
  protected readonly formatearIntervalo = formatearIntervalo;

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  protected readonly tope = computed(() => {
    const fijo = this.maximo();
    if (fijo !== null) {
      return fijo;
    }
    const valores = this.puntos().flatMap((p) => [p.valor ?? 0, p.intervalo?.superior ?? 0]);
    const mayor = Math.max(0, ...valores);
    return mayor === 0 ? 1 : mayor * 1.1;
  });

  protected readonly marcasY = computed(() => {
    const tope = this.tope();
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({ valor: f * tope, y: this.escalaY(f * tope) }));
  });

  protected readonly columnas = computed(() => {
    const grupos = this.grupos();
    const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
    const paso = anchoUtil / Math.max(1, grupos.length);
    return grupos.map((grupo, i) => ({
      grupo,
      etiqueta: this.etiquetasGrupo()[grupo] ?? grupo,
      centro: MARGEN.izquierda + paso * (i + 0.5),
      paso,
    }));
  });

  protected readonly dibujados = computed<PuntoDibujado[]>(() => {
    const columnas = new Map(this.columnas().map((c) => [c.grupo, c.centro]));
    const n = IDENTIFICADORES_ARQUITECTURA.length;
    return this.puntos()
      .filter((p) => p.valor !== null && columnas.has(p.grupo))
      .map((p) => {
        const indice = IDENTIFICADORES_ARQUITECTURA.indexOf(p.arquitectura);
        const x = (columnas.get(p.grupo) ?? 0) + (indice - (n - 1) / 2) * SEPARACION_SERIES;
        const valor = p.valor ?? 0;
        return {
          punto: p,
          x,
          y: this.escalaY(valor),
          yInferior: this.escalaY(p.intervalo?.inferior ?? valor),
          ySuperior: this.escalaY(p.intervalo?.superior ?? valor),
          color: COLOR_ARQUITECTURA[p.arquitectura],
          texto: `${p.arquitectura} · ${this.etiquetasGrupo()[p.grupo] ?? p.grupo}: ${this.formatear(valor)} (${formatearIntervalo(p.intervalo, this.formatoIntervalo())}; n = ${p.nTareas ?? '?'} tareas)`,
        };
      });
  });

  /** Filas de la tabla de respaldo: todas las combinaciones, incluidas las sin datos. */
  protected readonly filasTabla = computed(() =>
    this.grupos().flatMap((grupo) =>
      IDENTIFICADORES_ARQUITECTURA.map((arquitectura) => {
        const p = this.puntos().find((x) => x.grupo === grupo && x.arquitectura === arquitectura);
        return {
          grupo: this.etiquetasGrupo()[grupo] ?? grupo,
          arquitectura,
          valor: p?.valor ?? null,
          intervalo: p?.intervalo ?? null,
          nTareas: p?.nTareas ?? null,
        };
      }),
    ),
  );

  protected readonly seriesConDatos = computed(
    () =>
      new Set(
        this.puntos()
          .filter((p) => p.valor !== null)
          .map((p) => p.arquitectura),
      ),
  );

  protected formatear(valor: number | null): string {
    switch (this.formato()) {
      case 'porcentaje':
        return formatearPorcentaje(valor);
      case 'entero':
        return formatearEntero(valor);
      case 'ms':
        return formatearMs(valor);
      default:
        return formatearDecimal(valor);
    }
  }

  protected tieneDatos(arquitectura: IdentificadorArquitectura): boolean {
    return this.seriesConDatos().has(arquitectura);
  }

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
      ['grupo', 'arquitectura', 'valor', 'ic_inferior', 'ic_superior', 'nivel', 'n_tareas'],
      this.filasTabla().map((f) => [
        f.grupo,
        f.arquitectura,
        f.valor,
        f.intervalo?.inferior ?? null,
        f.intervalo?.superior ?? null,
        f.intervalo?.nivel ?? null,
        f.nTareas,
      ]),
      this.nombreArchivo(),
    );
  }

  private formatoIntervalo(): 'porcentaje' | 'decimal' | 'ms' {
    const f = this.formato();
    return f === 'porcentaje' || f === 'ms' ? f : 'decimal';
  }

  private escalaY(valor: number): number {
    const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
    return MARGEN.arriba + altoUtil - (valor / this.tope()) * altoUtil;
  }
}

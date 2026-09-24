import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Botones de descarga de una grafica del panel: SVG, PNG y la tabla de valores
 * en CSV. Cada grafica lleva su tabla porque dos colores de la paleta quedan
 * por debajo de 3:1 de contraste y la tabla es la lectura de respaldo.
 */
@Component({
  selector: 'app-chart-toolbar',
  template: `
    <div class="barra">
      <button
        type="button"
        class="boton-panel"
        (click)="tabla.emit()"
        [attr.aria-pressed]="tablaVisible()"
      >
        {{ tablaVisible() ? 'Ocultar tabla' : 'Ver tabla' }}
      </button>
      <button
        type="button"
        class="boton-panel"
        (click)="descargarSvg.emit()"
        title="Descargar la gráfica como SVG"
      >
        SVG
      </button>
      <button
        type="button"
        class="boton-panel"
        (click)="descargarPng.emit()"
        title="Descargar la gráfica como PNG"
      >
        PNG
      </button>
      <button
        type="button"
        class="boton-panel"
        (click)="descargarCsv.emit()"
        title="Descargar los valores como CSV"
      >
        CSV
      </button>
    </div>
  `,
  styles: `
    .barra {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0.5rem 0 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartToolbar {
  readonly tablaVisible = input(false);
  readonly tabla = output<void>();
  readonly descargarSvg = output<void>();
  readonly descargarPng = output<void>();
  readonly descargarCsv = output<void>();
}

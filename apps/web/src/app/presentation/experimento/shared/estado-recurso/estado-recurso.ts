import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Cargando, ausente o error de un archivo del experimento, con el mismo aspecto
 * en todo el panel. `ausente` es el caso normal antes de la primera corrida:
 * no es un fallo, es que todavia no hay nada que mostrar (HU-MET-09).
 */
@Component({
  selector: 'app-estado-recurso',
  template: `
    @if (cargando()) {
      <p class="cargando" role="status">Leyendo {{ nombre() }}…</p>
    } @else if (ausente()) {
      <div class="aviso aviso--info" role="status">
        <p>
          <strong>Todavía no existe {{ nombre() }}.</strong>
        </p>
        <p>{{ comoGenerarlo() }}</p>
        @if (comando()) {
          <pre>{{ comando() }}</pre>
        }
        <div class="tarjeta__acciones">
          <button type="button" class="boton-panel" (click)="reintentar.emit()">
            Volver a leer
          </button>
        </div>
      </div>
    } @else if (error()) {
      <div class="aviso aviso--error" role="alert">
        <p>
          <strong>No se pudo leer {{ nombre() }}.</strong>
        </p>
        <p>{{ error() }}</p>
        <div class="tarjeta__acciones">
          <button type="button" class="boton-panel" (click)="reintentar.emit()">Reintentar</button>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoRecurso {
  readonly nombre = input.required<string>();
  readonly cargando = input(false);
  readonly ausente = input(false);
  readonly error = input<string | null>(null);
  readonly comoGenerarlo = input('Se genera al correr el experimento.');
  readonly comando = input<string | null>(null);
  readonly reintentar = output<void>();
}

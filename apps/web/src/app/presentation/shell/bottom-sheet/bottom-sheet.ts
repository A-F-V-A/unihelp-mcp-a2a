import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterRenderEffect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** Fraccion de la altura que hay que arrastrar hacia abajo para cerrar. */
const FRACCION_CIERRE = 0.25;
/** Velocidad (px/ms) de un deslizamiento rapido que cierra por si solo. */
const VELOCIDAD_CIERRE = 0.5;

/**
 * Hoja inferior al estilo de las apps moviles: sube desde abajo, se cierra con
 * la X, tocando el fondo, con Escape o arrastrando el asa hacia abajo. En
 * pantallas grandes se muestra como un dialogo centrado.
 */
@Component({
  selector: 'app-bottom-sheet',
  templateUrl: './bottom-sheet.html',
  styleUrl: './bottom-sheet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'alEscape()' },
})
export class BottomSheet {
  readonly abierto = input(false);
  /** Nombre accesible del dialogo. */
  readonly etiqueta = input.required<string>();
  /** Ocupa casi toda la pantalla, para contenidos largos como Configuracion. */
  readonly completa = input(false);
  readonly cerrar = output<void>();

  protected readonly desplazamiento = signal(0);
  protected readonly arrastrando = signal(false);

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private inicio: { readonly y: number; readonly t: number } | null = null;
  private focoPrevio: HTMLElement | null = null;

  constructor() {
    // Lleva el foco al dialogo al abrir y lo devuelve a donde estaba al cerrar.
    afterRenderEffect(() => {
      const panel = this.panel().nativeElement;
      if (this.abierto()) {
        if (!this.focoPrevio) {
          const activo = document.activeElement;
          this.focoPrevio = activo instanceof HTMLElement ? activo : document.body;
          panel.focus({ preventScroll: true });
        }
      } else if (this.focoPrevio) {
        this.focoPrevio.focus({ preventScroll: true });
        this.focoPrevio = null;
      }
    });
  }

  protected alEscape(): void {
    if (this.abierto()) {
      this.cerrar.emit();
    }
  }

  protected iniciarArrastre(evento: PointerEvent): void {
    if (evento.pointerType === 'mouse' || !this.abierto()) {
      return;
    }
    const objetivo = evento.target as Element;
    if (!objetivo.closest('.hoja__asa, .hoja-cabecera') || objetivo.closest('button')) {
      return;
    }
    this.inicio = { y: evento.clientY, t: evento.timeStamp };
  }

  protected arrastrar(evento: PointerEvent): void {
    if (!this.inicio) {
      return;
    }
    const dy = evento.clientY - this.inicio.y;
    if (!this.arrastrando()) {
      if (dy < 6) {
        return;
      }
      this.arrastrando.set(true);
      this.panel().nativeElement.setPointerCapture(evento.pointerId);
    }
    this.desplazamiento.set(Math.max(0, dy));
  }

  protected soltar(evento: PointerEvent): void {
    const inicio = this.inicio;
    this.inicio = null;
    if (!inicio || !this.arrastrando()) {
      return;
    }

    const dy = Math.max(0, evento.clientY - inicio.y);
    const velocidad = dy / Math.max(1, evento.timeStamp - inicio.t);
    this.arrastrando.set(false);
    if (
      dy > this.panel().nativeElement.offsetHeight * FRACCION_CIERRE ||
      velocidad > VELOCIDAD_CIERRE
    ) {
      this.cerrar.emit();
    }
    // Sin el desplazamiento en linea, la transicion CSS lleva la hoja a su sitio (abierta o cerrada).
    this.desplazamiento.set(0);
  }
}

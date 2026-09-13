import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterRenderEffect,
  computed,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';

/** Ancho desde el borde izquierdo en el que un deslizamiento abre el menu. */
const ZONA_BORDE_PX = 28;
/** Movimiento minimo antes de decidir si el gesto es horizontal o un scroll. */
const UMBRAL_DECISION_PX = 8;
/** Velocidad (px/ms) a partir de la cual un gesto rapido decide por si solo. */
const VELOCIDAD_RAPIDA = 0.35;

interface Gesto {
  readonly x: number;
  readonly y: number;
  readonly t: number;
  readonly abiertoAlInicio: boolean;
  horizontal: boolean | null;
}

/**
 * Estructura de app movil: un menu lateral que se revela empujando la pantalla
 * principal (como las apps nativas), con gesto de deslizar desde el borde. En
 * escritorio el menu queda acoplado a la izquierda.
 *
 * Tambien ajusta la altura al area realmente visible, para que el teclado del
 * telefono no tape el campo de escritura.
 */
@Component({
  selector: 'app-layout',
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cerrarConEscape()' },
})
export class AppLayout {
  readonly menuAbierto = model(false);

  protected readonly acoplado = signal(false);
  /** Posicion del panel principal mientras se arrastra, en px; `null` fuera de un gesto. */
  protected readonly arrastre = signal<number | null>(null);
  protected readonly abiertoVisual = computed(() => this.menuAbierto() && !this.acoplado());
  protected readonly cajonInerte = computed(
    () => !this.acoplado() && !this.menuAbierto() && this.arrastre() === null,
  );
  protected readonly transformPrincipal = computed(() => {
    const px = this.arrastre();
    return px === null || this.acoplado() ? null : `translateX(${px}px)`;
  });

  private readonly cajon = viewChild.required<ElementRef<HTMLElement>>('cajon');
  private gesto: Gesto | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    if (typeof matchMedia === 'function') {
      const consulta = matchMedia('(width >= 64rem)');
      this.acoplado.set(consulta.matches);
      const alCambiar = (evento: MediaQueryListEvent) => {
        this.acoplado.set(evento.matches);
        if (evento.matches) {
          this.menuAbierto.set(false);
        }
      };
      consulta.addEventListener('change', alCambiar);
      destroyRef.onDestroy(() => consulta.removeEventListener('change', alCambiar));
    }

    const visual = typeof window === 'undefined' ? null : window.visualViewport;
    if (visual) {
      const raiz = document.documentElement;
      const ajustar = () => {
        raiz.style.setProperty('--alto-visible', `${visual.height}px`);
        raiz.style.setProperty('--desfase-visible', `${visual.offsetTop}px`);
      };
      ajustar();
      visual.addEventListener('resize', ajustar);
      visual.addEventListener('scroll', ajustar);
      destroyRef.onDestroy(() => {
        visual.removeEventListener('resize', ajustar);
        visual.removeEventListener('scroll', ajustar);
      });
    }

    afterRenderEffect(() => {
      if (this.abiertoVisual()) {
        this.cajon().nativeElement.focus({ preventScroll: true });
      }
    });
  }

  protected cerrar(): void {
    this.menuAbierto.set(false);
  }

  protected cerrarConEscape(): void {
    if (this.abiertoVisual()) {
      this.cerrar();
    }
  }

  protected alTocar(evento: PointerEvent): void {
    if (this.acoplado() || evento.pointerType === 'mouse') {
      return;
    }
    const abierto = this.menuAbierto();
    if (!abierto && evento.clientX > ZONA_BORDE_PX) {
      return;
    }
    this.gesto = {
      x: evento.clientX,
      y: evento.clientY,
      t: evento.timeStamp,
      abiertoAlInicio: abierto,
      horizontal: null,
    };
  }

  protected alMover(evento: PointerEvent): void {
    const gesto = this.gesto;
    if (!gesto) {
      return;
    }
    const dx = evento.clientX - gesto.x;
    const dy = evento.clientY - gesto.y;

    if (gesto.horizontal === null) {
      if (Math.abs(dx) < UMBRAL_DECISION_PX && Math.abs(dy) < UMBRAL_DECISION_PX) {
        return;
      }
      gesto.horizontal =
        Math.abs(dx) > Math.abs(dy) * 1.2 && (gesto.abiertoAlInicio ? dx < 0 : dx > 0);
      if (!gesto.horizontal) {
        this.gesto = null;
        return;
      }
      (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
    }

    const ancho = this.anchoCajon();
    const base = gesto.abiertoAlInicio ? ancho : 0;
    this.arrastre.set(Math.min(ancho, Math.max(0, base + dx)));
  }

  /**
   * Una vez decidido que el gesto es del menu, se cancela el desplazamiento
   * nativo: si no, el navegador interpreta el deslizamiento desde el borde como
   * "volver a la pagina anterior". Solo se cancela `touchmove`, nunca
   * `touchstart`, para no romper los toques (el boton de menu esta cerca del borde).
   */
  protected alMoverTactil(evento: TouchEvent): void {
    if (this.gesto?.horizontal && evento.cancelable) {
      evento.preventDefault();
    }
  }

  protected alSoltar(evento: PointerEvent): void {
    const gesto = this.gesto;
    const posicion = this.arrastre();
    this.gesto = null;
    if (!gesto?.horizontal || posicion === null) {
      this.arrastre.set(null);
      return;
    }

    const velocidad = (evento.clientX - gesto.x) / Math.max(1, evento.timeStamp - gesto.t);
    const abrir =
      velocidad > VELOCIDAD_RAPIDA
        ? true
        : velocidad < -VELOCIDAD_RAPIDA
          ? false
          : posicion > this.anchoCajon() / 2;
    this.menuAbierto.set(abrir);
    this.arrastre.set(null);
  }

  private anchoCajon(): number {
    return this.cajon().nativeElement.offsetWidth || 1;
  }
}

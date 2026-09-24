import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterRenderEffect,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ErrorVista } from '../../../application/state/conversacion.store';
import type { ResumenConversacion } from '../../../domain/models/conversacion';
import { agruparPorFecha, filtrarConversaciones } from '../../shared/agrupar-conversaciones';

/** Tiempo de pulsacion sostenida que abre las opciones de una conversacion. */
const PULSACION_LARGA_MS = 550;
/** Movimiento que convierte la pulsacion en un desplazamiento. */
const TOLERANCIA_MOVIMIENTO_PX = 10;

/**
 * Menu lateral: historial de conversaciones agrupado por fecha, busqueda,
 * acceso a los tickets, al panel del experimento y a la configuracion.
 */
@Component({
  selector: 'app-side-drawer',
  imports: [RouterLink],
  templateUrl: './side-drawer.html',
  styleUrl: './side-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideDrawer {
  readonly conversaciones = input.required<readonly ResumenConversacion[]>();
  readonly conversacionActivaId = input<string | null>(null);
  readonly cargando = input(false);
  readonly error = input<ErrorVista | null>(null);
  readonly cantidadTickets = input(0);

  readonly nuevaConversacion = output<void>();
  readonly abrirConversacion = output<string>();
  readonly opcionesConversacion = output<string>();
  readonly abrirTickets = output<void>();
  readonly abrirAjustes = output<void>();
  readonly reintentar = output<void>();

  protected readonly buscando = signal(false);
  protected readonly consulta = signal('');
  protected readonly grupos = computed(() =>
    agruparPorFecha(filtrarConversaciones(this.conversaciones(), this.consulta())),
  );
  protected readonly mostrarEsqueleto = computed(
    () => this.cargando() && this.conversaciones().length === 0,
  );

  private readonly campoBusqueda = viewChild<ElementRef<HTMLInputElement>>('busqueda');
  private pulsacion: {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly temporizador: ReturnType<typeof setTimeout>;
  } | null = null;
  /** La conversacion cuya pulsacion larga ya abrio opciones: su click posterior se ignora. */
  private pulsacionAtendida: string | null = null;

  constructor() {
    afterRenderEffect(() => {
      if (this.buscando()) {
        this.campoBusqueda()?.nativeElement.focus();
      }
    });
  }

  protected abrirBusqueda(): void {
    this.buscando.set(true);
  }

  protected cerrarBusqueda(): void {
    this.buscando.set(false);
    this.consulta.set('');
  }

  protected alTocarConversacion(id: string): void {
    if (this.pulsacionAtendida === id) {
      this.pulsacionAtendida = null;
      return;
    }
    this.abrirConversacion.emit(id);
  }

  /** En pantallas tactiles, mantener pulsada una conversacion abre sus opciones. */
  protected iniciarPulsacion(id: string, evento: PointerEvent): void {
    if (evento.pointerType === 'mouse') {
      return;
    }
    this.cancelarPulsacion();
    this.pulsacion = {
      id,
      x: evento.clientX,
      y: evento.clientY,
      temporizador: setTimeout(() => {
        this.pulsacion = null;
        this.pulsacionAtendida = id;
        if ('vibrate' in navigator) {
          navigator.vibrate(12);
        }
        this.opcionesConversacion.emit(id);
      }, PULSACION_LARGA_MS),
    };
  }

  protected moverPulsacion(evento: PointerEvent): void {
    const pulsacion = this.pulsacion;
    if (
      pulsacion &&
      Math.hypot(evento.clientX - pulsacion.x, evento.clientY - pulsacion.y) >
        TOLERANCIA_MOVIMIENTO_PX
    ) {
      this.cancelarPulsacion();
    }
  }

  protected cancelarPulsacion(): void {
    if (this.pulsacion) {
      clearTimeout(this.pulsacion.temporizador);
      this.pulsacion = null;
    }
  }
}

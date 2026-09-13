import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LONGITUD_SOLICITUD } from '@unihelp/dominio';

/**
 * Campo de texto libre (HU-FE-06): sin servicio, categoria ni prioridad. No
 * valida el minimo: un texto corto se envia y el sistema pide aclaracion, en
 * lugar de bloquear con un error generico.
 */
@Component({
  selector: 'app-message-composer',
  templateUrl: './message-composer.html',
  styleUrl: './message-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageComposer {
  readonly deshabilitado = input(false);
  readonly enviar = output<string>();
  readonly abrirSugerencias = output<void>();

  protected readonly maxima = LONGITUD_SOLICITUD.maxima;
  protected readonly texto = signal('');
  protected readonly longitud = computed(() => this.texto().length);
  protected readonly vacio = computed(() => this.texto().trim().length === 0);
  /** El contador solo aparece cuando empieza a importar. */
  protected readonly mostrarContador = computed(() => this.longitud() >= this.maxima * 0.75);
  protected readonly cercaDelLimite = computed(() => this.longitud() > this.maxima * 0.9);

  private readonly campo = viewChild.required<ElementRef<HTMLTextAreaElement>>('campo');
  /**
   * En pantallas tactiles Enter hace salto de linea (se envia con el boton) y
   * el teclado no se reabre solo, porque taparia la respuesta que acaba de llegar.
   */
  private readonly tactil =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  private haEnviado = false;

  constructor() {
    // Con teclado fisico devuelve el foco al llegar la respuesta, no en la carga inicial.
    effect(() => {
      if (!this.deshabilitado() && this.haEnviado && !this.tactil) {
        this.campo().nativeElement.focus();
      }
    });
  }

  protected actualizar(campo: HTMLTextAreaElement): void {
    this.texto.set(campo.value);
    this.ajustarAltura(campo);
  }

  protected alPresionarEnter(evento: Event): void {
    const tecla = evento as KeyboardEvent;
    if (tecla.shiftKey || tecla.isComposing || this.tactil) {
      return;
    }
    evento.preventDefault();
    this.emitir();
  }

  protected emitir(): void {
    if (this.deshabilitado() || this.vacio()) {
      return;
    }
    this.haEnviado = true;
    this.enviar.emit(this.texto());
    this.texto.set('');

    const campo = this.campo().nativeElement;
    campo.value = '';
    this.ajustarAltura(campo);
    if (this.tactil) {
      campo.blur();
    }
  }

  /** El campo crece con el texto hasta su altura maxima (definida en CSS). */
  private ajustarAltura(campo: HTMLTextAreaElement): void {
    campo.style.height = 'auto';
    campo.style.height = `${campo.scrollHeight}px`;
  }
}

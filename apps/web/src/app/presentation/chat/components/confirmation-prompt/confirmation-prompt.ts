import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { AccionPropuesta, ErrorVista } from '../../../../application/state/conversacion.store';
import type { PropuestaTicket } from '../../../../domain/models/ticket';
import { ETIQUETA_PRIORIDAD, nombreServicio } from '../../../shared/formato';

let secuencia = 0;

/**
 * Resumen de la propuesta de ticket con dos acciones de igual peso visual
 * (HU-FE-16, HU-FE-17, HU-FE-18). El componente solo emite eventos; nunca
 * decide por su cuenta confirmar ni rechazar.
 */
@Component({
  selector: 'app-confirmation-prompt',
  templateUrl: './confirmation-prompt.html',
  styleUrl: './confirmation-prompt.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationPrompt {
  readonly propuesta = input.required<PropuestaTicket>();
  /** Accion en curso sobre esta propuesta, si la hay. */
  readonly accion = input<AccionPropuesta | null>(null);
  readonly error = input<ErrorVista | null>(null);

  readonly confirmar = output<void>();
  readonly rechazar = output<void>();

  protected readonly idTitulo = `propuesta-titulo-${++secuencia}`;
  protected readonly servicio = computed(() => nombreServicio(this.propuesta().servicio));
  protected readonly prioridad = computed(() => ETIQUETA_PRIORIDAD[this.propuesta().prioridad]);
  protected readonly ocupada = computed(() => this.accion() !== null);
}

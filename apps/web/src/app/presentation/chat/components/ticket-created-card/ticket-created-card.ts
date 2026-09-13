import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Ticket } from '../../../../domain/models/ticket';
import { FechaPipe } from '../../../shared/fecha.pipe';
import {
  ETIQUETA_ESTADO_INCIDENTE,
  ETIQUETA_PRIORIDAD,
  nombreServicio,
} from '../../../shared/formato';

/** Numero y estado inicial del ticket recien creado (HU-FE-19). */
@Component({
  selector: 'app-ticket-created-card',
  imports: [FechaPipe],
  templateUrl: './ticket-created-card.html',
  styleUrl: './ticket-created-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketCreatedCard {
  readonly ticket = input.required<Ticket>();

  protected readonly estado = computed(() => ETIQUETA_ESTADO_INCIDENTE[this.ticket().estado]);
  protected readonly prioridad = computed(() => ETIQUETA_PRIORIDAD[this.ticket().prioridad]);
  protected readonly servicio = computed(() => nombreServicio(this.ticket().servicio));
}

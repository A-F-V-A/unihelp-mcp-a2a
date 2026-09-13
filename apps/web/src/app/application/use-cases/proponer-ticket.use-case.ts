import { Injectable, inject } from '@angular/core';
import type { PropuestaTicket } from '../../domain/models/ticket';
import { TICKET_REPOSITORY } from '../di/tokens';

/** Pide una propuesta de ticket. Nunca crea el ticket. */
@Injectable({ providedIn: 'root' })
export class ProponerTicketUseCase {
  private readonly tickets = inject(TICKET_REPOSITORY);

  ejecutar(conversacionId: string): Promise<PropuestaTicket> {
    return this.tickets.proponerTicket({ conversacionId });
  }
}

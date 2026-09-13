import { Injectable, inject } from '@angular/core';
import { ErrorBackend } from '../../domain/errors/error-backend';
import type { PropuestaTicket } from '../../domain/models/ticket';
import { propuestaPendiente } from '../../domain/rules/propuesta.rules';
import { TICKET_REPOSITORY } from '../di/tokens';

@Injectable({ providedIn: 'root' })
export class RechazarTicketUseCase {
  private readonly tickets = inject(TICKET_REPOSITORY);

  async ejecutar(propuesta: PropuestaTicket): Promise<PropuestaTicket> {
    if (!propuestaPendiente(propuesta)) {
      throw new ErrorBackend(
        'conflicto',
        `La propuesta ya fue ${propuesta.estado} y no puede rechazarse.`,
        { estado: propuesta.estado },
      );
    }

    return this.tickets.rechazarTicket(propuesta.id);
  }
}

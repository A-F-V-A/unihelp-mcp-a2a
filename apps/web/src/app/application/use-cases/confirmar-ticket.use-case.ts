import { Injectable, inject } from '@angular/core';
import { ErrorBackend } from '../../domain/errors/error-backend';
import type { PropuestaTicket, Ticket } from '../../domain/models/ticket';
import { propuestaPendiente } from '../../domain/rules/propuesta.rules';
import { TICKET_REPOSITORY } from '../di/tokens';

/**
 * Crea el ticket de una propuesta pendiente. Exige una `ConfirmacionExplicita`:
 * solo la accion del boton "Confirmar" puede construirla (HU-FE-17).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmarTicketUseCase {
  private readonly tickets = inject(TICKET_REPOSITORY);

  async ejecutar(propuesta: PropuestaTicket): Promise<Ticket> {
    if (!propuestaPendiente(propuesta)) {
      throw new ErrorBackend(
        'conflicto',
        `La propuesta ya fue ${propuesta.estado} y no puede confirmarse.`,
        { estado: propuesta.estado },
      );
    }

    return this.tickets.confirmarTicket({ propuestaId: propuesta.id, origen: 'accion-usuario' });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ErrorTickets } from '../dominio/errores';
import type { Propuesta } from '../dominio/modelos';
import type { TicketsRepository } from '../dominio/puertos/tickets.repository';
import { RegistroAuditoria } from './registro-auditoria';
import {
  type ContextoOperacion,
  RELOJ_TICKETS,
  type RelojTickets,
  TICKETS_REPOSITORY,
} from './tokens';

/**
 * Lecturas y rechazo de propuestas para el flujo del frontend (decision 13):
 * la tarjeta de propuesta y el boton "No crear". No crea ningun ticket.
 */
@Injectable()
export class ConsultarPropuestasUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly repositorio: TicketsRepository,
    @Inject(RELOJ_TICKETS) private readonly reloj: RelojTickets,
    @Inject(RegistroAuditoria) private readonly auditoria: RegistroAuditoria,
  ) {}

  /** La propuesta pendiente mas reciente de la conversacion, o `null`. */
  pendienteDe(conversacionId: string): Promise<Propuesta | null> {
    return this.repositorio.ultimaPropuestaPendiente(conversacionId);
  }

  obtener(propuestaId: string): Promise<Propuesta | null> {
    return this.repositorio.obtenerPropuesta(propuestaId);
  }

  /**
   * Descarta la propuesta (HU-15). Rechazar dos veces devuelve la misma propuesta.
   * @throws ErrorTickets si no existe o si ya se confirmo.
   */
  async rechazar(propuestaId: string, contexto: ContextoOperacion): Promise<Propuesta> {
    const propuesta = await this.repositorio.obtenerPropuesta(propuestaId);
    if (propuesta === null) {
      throw new ErrorTickets('RECURSO_NO_ENCONTRADO', 'La propuesta no existe.', { propuestaId });
    }
    if (propuesta.estado === 'rechazada') {
      return propuesta;
    }
    if (propuesta.estado === 'confirmada') {
      throw new ErrorTickets(
        'PROPUESTA_RESUELTA',
        'La propuesta ya se confirmó y el ticket existe; no se puede rechazar.',
        { propuestaId },
      );
    }
    const ahora = this.reloj.ahora();
    await this.repositorio.actualizarPropuesta(propuestaId, {
      estado: 'rechazada',
      resueltaEn: ahora,
      ticketNumero: null,
    });
    await this.auditoria.registrar({
      ...contexto,
      accion: 'ticket.reject',
      recurso: propuestaId,
      resultado: 'OK',
      cuerpo: { propuestaId },
    });
    return { ...propuesta, estado: 'rechazada', resueltaEn: ahora };
  }
}

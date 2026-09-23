import { Inject, Injectable } from '@nestjs/common';
import type { EventoAuditoria, Ticket } from '../dominio/modelos';
import type { TicketsRepository } from '../dominio/puertos/tickets.repository';
import { TICKETS_REPOSITORY } from './tokens';

/** Lo que el ejecutor del experimento necesita del lado servidor de una ejecucion. */
export interface AuditoriaDeEjecucion {
  readonly eventos: readonly EventoAuditoria[];
  readonly tickets: readonly Ticket[];
}

/**
 * Lee el registro de auditoria y los tickets de UNA ejecucion, identificada por
 * su `trace_id` (HU-33). Es la fuente independiente con la que la compuerta
 * automatica verifica `esperado.ticket`: se comprueba contra lo que quedo
 * escrito, nunca contra lo que el agente diga que hizo (docs/04, seccion 4).
 *
 * Solo lee: la auditoria es de solo agregar y ninguna consulta la modifica
 * (HU-35, RM-09).
 */
@Injectable()
export class ConsultarAuditoriaUseCase {
  constructor(@Inject(TICKETS_REPOSITORY) private readonly repositorio: TicketsRepository) {}

  async ejecutar(traceId: string): Promise<AuditoriaDeEjecucion> {
    const [eventos, tickets] = await Promise.all([
      this.repositorio.listarEventos(traceId),
      this.repositorio.listarTicketsDeTrace(traceId),
    ]);
    return { eventos, tickets };
  }
}

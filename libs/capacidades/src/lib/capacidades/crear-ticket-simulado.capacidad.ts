import { Inject, Injectable } from '@nestjs/common';
import type { ContextoInvocacion, SalidaCapacidad } from '@unihelp/herramientas';
import { CrearTicketUseCase } from '@unihelp/tickets';
import type { Capacidad } from '../capacidad';

/**
 * `crear_ticket_simulado` (HU-16, HU-17). La validacion del token la hace
 * `CrearTicketUseCase`: ni B0 ni `mcp-server` la hacen por su cuenta: la garantia es el
 * mismo codigo en ambas (HU-16).
 */
@Injectable()
export class CrearTicketSimuladoCapacidad implements Capacidad {
  readonly nombre = 'crear_ticket_simulado';

  constructor(@Inject(CrearTicketUseCase) private readonly crear: CrearTicketUseCase) {}

  async ejecutar(
    argumentos: Record<string, unknown>,
    contexto: ContextoInvocacion,
  ): Promise<SalidaCapacidad> {
    const resultado = await this.crear.ejecutar(
      String(argumentos['proposal_id']),
      String(argumentos['confirmacion_token']),
      { traceId: contexto.traceId, actor: contexto.actor },
    );
    return {
      paraModelo: {
        ticket_id: resultado.ticket.numero,
        estado: resultado.ticket.estado,
        creado_en: resultado.ticket.creadoEn.toISOString(),
        creado: true,
        motivo: null,
      },
      estructurado: resultado,
    };
  }
}

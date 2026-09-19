import { Inject, Injectable } from '@nestjs/common';
import type { ContextoInvocacion, SalidaCapacidad } from '@unihelp/herramientas';
import { CrearTicketUseCase } from '@unihelp/tickets';
import type { AdaptadorHerramienta } from './adaptador';

/**
 * `crear_ticket_simulado` (HU-16, HU-17). La validacion del token la hace
 * `CrearTicketUseCase`: B0 NUNCA la hace por su cuenta, para que la garantia sea
 * el mismo codigo que en B1.
 */
@Injectable()
export class AdaptadorCrearTicketSimulado implements AdaptadorHerramienta {
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

import { Inject, Injectable } from '@nestjs/common';
import { ConsultarComponentesDeServicioUseCase } from '@unihelp/conocimiento';
import type { ContextoInvocacion, SalidaCapacidad } from '@unihelp/herramientas';
import {
  type CategoriaTicket,
  type CodigoPrioridad,
  ProponerTicketUseCase,
} from '@unihelp/tickets';
import type { Capacidad } from '../capacidad';

/**
 * `proponer_ticket` (HU-13). Lee el estado publicado del servicio para que el
 * caso de uso verifique la prioridad contra la tabla institucional (HU-11).
 */
@Injectable()
export class ProponerTicketCapacidad implements Capacidad {
  readonly nombre = 'proponer_ticket';

  constructor(
    @Inject(ConsultarComponentesDeServicioUseCase)
    private readonly consultar: ConsultarComponentesDeServicioUseCase,
    @Inject(ProponerTicketUseCase) private readonly proponer: ProponerTicketUseCase,
  ) {}

  async ejecutar(
    argumentos: Record<string, unknown>,
    contexto: ContextoInvocacion,
  ): Promise<SalidaCapacidad> {
    const { servicio, estado } = await this.consultar.ejecutar(String(argumentos['servicio']));
    const propuesta = await this.proponer.ejecutar(
      {
        conversacionId: contexto.conversacionId,
        categoria: argumentos['categoria'] as CategoriaTicket,
        prioridad: argumentos['prioridad'] as CodigoPrioridad,
        resumen: String(argumentos['resumen']),
        descripcion: String(argumentos['descripcion']),
      },
      {
        servicioCodigo: servicio.codigo,
        estado: estado.estado,
        alcance: estado.alcance,
        nivelServicio: servicio.nivelServicio,
      },
      { traceId: contexto.traceId, actor: contexto.actor },
    );
    return {
      paraModelo: {
        proposal_id: propuesta.id,
        resumen_legible: propuesta.resumenLegible,
        campos_faltantes: propuesta.camposFaltantes,
        expira_en: propuesta.expiraEn.toISOString(),
        listo_para_confirmar: propuesta.camposFaltantes.length === 0,
      },
      estructurado: propuesta,
    };
  }
}

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorTickets } from '../dominio/errores';
import {
  type CategoriaTicket,
  type Propuesta,
  VIGENCIA_PROPUESTA_MINUTOS,
} from '../dominio/modelos';
import type { CodigoPrioridad, ContextoServicio } from '../dominio/prioridad';
import type { TicketsRepository } from '../dominio/puertos/tickets.repository';
import { prioridadesAdmisibles } from '../dominio/reglas/tabla-prioridad.rules';
import { RegistroAuditoria } from './registro-auditoria';
import {
  type ContextoOperacion,
  RELOJ_TICKETS,
  type RelojTickets,
  TICKETS_REPOSITORY,
} from './tokens';

/** Datos que escribe el agente. Ya validados contra el esquema de `proponer_ticket`. */
export interface DatosPropuesta {
  readonly conversacionId: string;
  readonly categoria: CategoriaTicket;
  readonly prioridad: CodigoPrioridad;
  readonly resumen: string;
  readonly descripcion: string;
}

/**
 * Valida los datos de un ticket y registra una propuesta. NO crea el ticket
 * (HU-13): eso exige una confirmacion y un token.
 *
 * La prioridad la escribe el modelo y aqui se verifica contra la tabla
 * institucional: un ticket nunca queda con una prioridad que ninguna fila
 * respalde (HU-11; DP-02 resuelta: el modelo escribe, el codigo verifica).
 */
@Injectable()
export class ProponerTicketUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly repositorio: TicketsRepository,
    @Inject(RELOJ_TICKETS) private readonly reloj: RelojTickets,
    @Inject(RegistroAuditoria) private readonly auditoria: RegistroAuditoria,
  ) {}

  /**
   * @param servicio estado publicado del servicio, leido de la base de conocimiento por quien invoca.
   * @throws ErrorTickets `VALIDACION_ENTRADA` en mantenimiento (HU-12) o con una prioridad fuera de la tabla.
   */
  async ejecutar(
    datos: DatosPropuesta,
    servicio: ContextoServicio,
    contexto: ContextoOperacion,
  ): Promise<Propuesta> {
    const cuerpo = { ...datos, servicio: servicio.servicioCodigo };
    try {
      this.verificarPrioridad(datos.prioridad, servicio);
    } catch (fallo) {
      await this.auditoria.registrar({
        ...contexto,
        accion: 'ticket.propose',
        recurso: servicio.servicioCodigo,
        resultado: 'RECHAZADO',
        motivo: fallo instanceof Error ? fallo.message : 'Prioridad inválida.',
        cuerpo,
      });
      throw fallo;
    }

    const ahora = this.reloj.ahora();
    const propuesta: Propuesta = {
      id: randomUUID(),
      conversacionId: datos.conversacionId,
      traceId: contexto.traceId,
      servicio: servicio.servicioCodigo,
      categoria: datos.categoria,
      prioridad: datos.prioridad,
      resumen: datos.resumen,
      descripcion: datos.descripcion,
      solicitante: `solicitante-${datos.conversacionId}`,
      resumenLegible: [
        `Servicio: ${servicio.servicioCodigo}`,
        `Categoría: ${datos.categoria}`,
        `Prioridad: ${datos.prioridad}`,
        `Resumen: ${datos.resumen}`,
        `Descripción: ${datos.descripcion}`,
      ].join('\n'),
      camposFaltantes: [],
      estado: 'pendiente',
      creadaEn: ahora,
      expiraEn: new Date(ahora.getTime() + VIGENCIA_PROPUESTA_MINUTOS * 60_000),
      resueltaEn: null,
      ticketNumero: null,
    };
    await this.repositorio.guardarPropuesta(propuesta);
    await this.auditoria.registrar({
      ...contexto,
      accion: 'ticket.propose',
      recurso: propuesta.id,
      resultado: 'OK',
      cuerpo,
    });
    return propuesta;
  }

  private verificarPrioridad(prioridad: CodigoPrioridad, servicio: ContextoServicio): void {
    if (servicio.estado === 'mantenimiento') {
      throw new ErrorTickets(
        'VALIDACION_ENTRADA',
        'El servicio está en mantenimiento programado: se informa la ventana y no se propone ticket.',
        { servicio: servicio.servicioCodigo },
      );
    }
    const admisibles = prioridadesAdmisibles(servicio);
    if (admisibles.length === 0) {
      throw new ErrorTickets(
        'VALIDACION_ENTRADA',
        `La tabla institucional no define una prioridad para ${servicio.servicioCodigo} en su estado actual.`,
        { servicio: servicio.servicioCodigo },
      );
    }
    if (!admisibles.includes(prioridad)) {
      throw new ErrorTickets(
        'VALIDACION_ENTRADA',
        `La prioridad ${prioridad} no corresponde a la tabla institucional para el estado actual de ${servicio.servicioCodigo}. Valores admitidos: ${admisibles.join(', ')}.`,
        { prioridad, admitidas: admisibles.join(',') },
      );
    }
  }
}

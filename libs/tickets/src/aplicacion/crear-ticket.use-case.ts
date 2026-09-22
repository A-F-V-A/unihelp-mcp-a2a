import { Inject, Injectable } from '@nestjs/common';
import { ErrorTickets } from '../dominio/errores';
import type { Propuesta, Ticket } from '../dominio/modelos';
import type { TicketsRepository } from '../dominio/puertos/tickets.repository';
import { huellaToken } from './confirmar-propuesta.use-case';
import { RegistroAuditoria } from './registro-auditoria';
import {
  type ContextoOperacion,
  RELOJ_TICKETS,
  type RelojTickets,
  TICKETS_REPOSITORY,
} from './tokens';

/** Formato institucional del contrato de red. Ej.: `UH-2026-001208` (HU-17). */
export function formatearNumeroTicket(anio: number, secuencia: number): string {
  return `UH-${anio}-${String(secuencia).padStart(6, '0')}`;
}

type Veredicto =
  | { readonly tipo: 'creado'; readonly ticket: Ticket; readonly existente: boolean }
  | { readonly tipo: 'rechazado'; readonly error: ErrorTickets };

/**
 * GARANTIA MECANICA de HU-16: crea el ticket si y solo si el token existe, fue
 * emitido para ESTA propuesta y no vencio. Ningun texto, argumento ni contenido
 * recuperado la puede saltar, porque no depende del modelo. Todo intento,
 * aceptado o rechazado, queda en la auditoria con su motivo (M5.1, M5.2).
 */
@Injectable()
export class CrearTicketUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly repositorio: TicketsRepository,
    @Inject(RELOJ_TICKETS) private readonly reloj: RelojTickets,
    @Inject(RegistroAuditoria) private readonly auditoria: RegistroAuditoria,
  ) {}

  /**
   * Un reintento sobre la misma propuesta devuelve el ticket existente (RN-03).
   * @throws ErrorTickets `CONFIRMACION_REQUERIDA`, `PROPUESTA_EXPIRADA`, `PROPUESTA_INCOMPLETA` o `RECURSO_NO_ENCONTRADO`.
   */
  async ejecutar(
    propuestaId: string,
    token: string,
    contexto: ContextoOperacion,
  ): Promise<{ readonly ticket: Ticket; readonly existente: boolean }> {
    const veredicto = await this.repositorio.transaccion((tx) =>
      this.decidir(tx, propuestaId, token),
    );
    // La auditoria se escribe FUERA de la transaccion: un rechazo no se revierte con ella.
    const tokenValido = veredicto.tipo === 'creado';
    await this.auditoria.registrar({
      ...contexto,
      accion: 'ticket.create',
      recurso: propuestaId,
      resultado: tokenValido ? 'OK' : 'RECHAZADO',
      motivo:
        veredicto.tipo === 'rechazado'
          ? veredicto.error.message
          : veredicto.existente
            ? 'Reintento: se devuelve el ticket existente.'
            : null,
      tokenValido,
      cuerpo: { propuestaId, confirmacionToken: huellaToken(token) },
    });
    if (veredicto.tipo === 'rechazado') {
      throw veredicto.error;
    }
    return { ticket: veredicto.ticket, existente: veredicto.existente };
  }

  private async decidir(
    tx: TicketsRepository,
    propuestaId: string,
    token: string,
  ): Promise<Veredicto> {
    const propuesta = await tx.bloquearPropuesta(propuestaId);
    if (propuesta === null) {
      return rechazo('RECURSO_NO_ENCONTRADO', 'La propuesta no existe.');
    }
    const confirmacion = await tx.obtenerConfirmacion(propuestaId);
    const ahora = this.reloj.ahora();
    const tokenCorrecto =
      confirmacion !== null &&
      confirmacion.tokenHash === huellaToken(token) &&
      confirmacion.expiraEn.getTime() > ahora.getTime();

    const existente = await tx.obtenerTicketDePropuesta(propuestaId);
    if (existente !== null && tokenCorrecto) {
      return { tipo: 'creado', ticket: existente, existente: true };
    }
    const bloqueo = this.bloqueo(propuesta, ahora);
    if (bloqueo !== null) {
      return { tipo: 'rechazado', error: bloqueo };
    }
    if (!tokenCorrecto) {
      return rechazo(
        'CONFIRMACION_REQUERIDA',
        'No se puede crear el ticket sin una confirmación explícita y vigente de la persona para esta propuesta.',
      );
    }

    const secuencia = await tx.siguienteNumeroTicket();
    const ticket: Ticket = {
      numero: formatearNumeroTicket(ahora.getUTCFullYear(), secuencia),
      propuestaId,
      conversacionId: propuesta.conversacionId,
      traceId: propuesta.traceId,
      servicio: propuesta.servicio,
      categoria: propuesta.categoria,
      prioridad: propuesta.prioridad,
      estado: 'recibido',
      creadoEn: ahora,
    };
    await tx.guardarTicket(ticket);
    await tx.actualizarPropuesta(propuestaId, {
      estado: 'confirmada',
      resueltaEn: ahora,
      ticketNumero: ticket.numero,
    });
    return { tipo: 'creado', ticket, existente: false };
  }

  private bloqueo(propuesta: Propuesta, ahora: Date): ErrorTickets | null {
    if (propuesta.estado === 'rechazada') {
      // Una propuesta descartada no se reutiliza (HU-15).
      return new ErrorTickets(
        'CONFIRMACION_REQUERIDA',
        'La propuesta fue rechazada por la persona y no se puede usar para crear un ticket.',
      );
    }
    if (propuesta.expiraEn.getTime() <= ahora.getTime()) {
      return new ErrorTickets('PROPUESTA_EXPIRADA', 'La propuesta venció; hay que preparar otra.');
    }
    if (propuesta.camposFaltantes.length > 0) {
      return new ErrorTickets(
        'PROPUESTA_INCOMPLETA',
        `Faltan datos en la propuesta: ${propuesta.camposFaltantes.join(', ')}.`,
      );
    }
    return null;
  }
}

function rechazo(codigo: ErrorTickets['codigo'], mensaje: string): Veredicto {
  return { tipo: 'rechazado', error: new ErrorTickets(codigo, mensaje) };
}

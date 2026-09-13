import { Injectable, inject } from '@angular/core';
import type { MensajeAsistenteDto, PropuestaTicketDto, TicketDto } from '@unihelp/contratos';
import type {
  ConfirmacionExplicita,
  PropuestaTicket,
  SolicitudPropuestaTicket,
  Ticket,
} from '../../domain/models/ticket';
import type { TicketRepository } from '../../domain/ports/ticket.repository';
import { mapearPropuestaTicket, mapearTicket } from '../mappers/ticket.mapper';
import { BaseDatosSimulada, type EstadoBaseDatos, generarId } from './base-datos-simulada';
import { falloApi } from './errores-api';
import { ESCENARIOS } from './fixtures/escenarios.fixture';
import { formatearNumeroTicket } from './fixtures/tickets.fixture';
import { SimuladorRed } from './simulador-red';

const MENSAJES_EN_DESCRIPCION = 3;

@Injectable()
export class MockTicketRepository implements TicketRepository {
  private readonly red = inject(SimuladorRed);
  private readonly bd = inject(BaseDatosSimulada);

  async proponerTicket(solicitud: SolicitudPropuestaTicket): Promise<PropuestaTicket> {
    const dto = await this.red.responder('proponerTicket', () =>
      this.bd.transaccion((estado) => this.crearPropuesta(estado, solicitud.conversacionId)),
    );
    return mapearPropuestaTicket(dto);
  }

  async confirmarTicket(confirmacion: ConfirmacionExplicita): Promise<Ticket> {
    const dto = await this.red.responder('confirmarTicket', () =>
      this.bd.transaccion((estado) => this.crearTicket(estado, confirmacion)),
    );
    return mapearTicket(dto);
  }

  async rechazarTicket(propuestaId: string): Promise<PropuestaTicket> {
    const dto = await this.red.responder('rechazarTicket', () =>
      this.bd.transaccion((estado) => {
        const propuesta = this.propuestaPendiente(estado, propuestaId);
        const rechazada: PropuestaTicketDto = {
          ...propuesta,
          estado: 'rechazada',
          resueltaEn: new Date().toISOString(),
        };
        this.guardarPropuesta(estado, rechazada);
        return rechazada;
      }),
    );
    return mapearPropuestaTicket(dto);
  }

  private crearPropuesta(estado: EstadoBaseDatos, conversacionId: string): PropuestaTicketDto {
    const conversacion = estado.conversaciones[conversacionId];
    if (!conversacion) {
      throw falloApi('no-encontrado', 'La conversación no existe o ya expiró.', { conversacionId });
    }

    const borrador = conversacion.borradorPropuesta;
    if (!borrador) {
      throw falloApi(
        'validacion',
        'No hay un diagnóstico en la conversación que justifique proponer un ticket.',
        { conversacionId },
      );
    }

    const relatos = conversacion.mensajes
      .filter((mensaje) => mensaje.rol === 'usuario')
      .slice(-MENSAJES_EN_DESCRIPCION)
      .map((mensaje) => `«${mensaje.texto}»`);
    const tema = ESCENARIOS.find((e) => e.id === conversacion.ultimoEscenarioId)?.tema;

    const ahora = new Date().toISOString();
    const propuesta: PropuestaTicketDto = {
      id: generarId(estado, 'prop'),
      conversacionId,
      servicio: borrador.servicio,
      categoria: borrador.categoria,
      prioridad: borrador.prioridad,
      resumen: borrador.resumen,
      descripcion:
        `El solicitante reporta: ${relatos.join(' ')}` +
        (tema ? ` Diagnóstico de UniHelp relacionado con ${tema}.` : ''),
      estado: 'pendiente',
      creadaEn: ahora,
      resueltaEn: null,
      ticketNumero: null,
    };

    const mensaje: MensajeAsistenteDto = {
      id: `msg-${propuesta.id}`,
      rol: 'asistente',
      turno: conversacion.turnosUsados,
      clasificacion: null,
      bloques: [{ tipo: 'propuesta-ticket', propuesta }],
      enviadoEn: ahora,
    };

    estado.propuestas[propuesta.id] = propuesta;
    estado.borradoresPorPropuesta[propuesta.id] = borrador;
    conversacion.mensajes.push(mensaje);
    conversacion.borradorPropuesta = null;
    return propuesta;
  }

  private crearTicket(estado: EstadoBaseDatos, confirmacion: ConfirmacionExplicita): TicketDto {
    // El contrato HTTP exige `confirmacionExplicita: true`; aqui se verifica el equivalente.
    if (confirmacion.origen !== 'accion-usuario') {
      throw falloApi('validacion', 'La creación de un ticket requiere confirmación explícita.');
    }

    const propuesta = this.propuestaPendiente(estado, confirmacion.propuestaId);
    const conversacion = estado.conversaciones[propuesta.conversacionId];
    const borrador = estado.borradoresPorPropuesta[propuesta.id];

    estado.secuenciaTicket += 1;
    const ahora = new Date().toISOString();
    const ticket: TicketDto = {
      numero: formatearNumeroTicket(estado.secuenciaTicket),
      propuestaId: propuesta.id,
      conversacionId: propuesta.conversacionId,
      servicio: propuesta.servicio,
      categoria: propuesta.categoria,
      prioridad: propuesta.prioridad,
      estado: borrador?.estadoInicialTicket ?? 'recibido',
      creadoEn: ahora,
      atencionEstimada: borrador?.atencionEstimada ?? null,
    };

    this.guardarPropuesta(estado, {
      ...propuesta,
      estado: 'confirmada',
      resueltaEn: ahora,
      ticketNumero: ticket.numero,
    });
    estado.tickets[ticket.numero] = ticket;
    conversacion?.mensajes.push({
      id: `msg-ticket-${ticket.numero}`,
      rol: 'asistente',
      turno: conversacion.turnosUsados,
      clasificacion: null,
      bloques: [{ tipo: 'ticket-creado', ticket }],
      enviadoEn: ahora,
    });

    return ticket;
  }

  private propuestaPendiente(estado: EstadoBaseDatos, propuestaId: string): PropuestaTicketDto {
    const propuesta = estado.propuestas[propuestaId];
    if (!propuesta) {
      throw falloApi('no-encontrado', 'La propuesta de ticket no existe.', { propuestaId });
    }
    if (propuesta.estado !== 'pendiente') {
      throw falloApi('conflicto', `La propuesta ya fue ${propuesta.estado}.`, {
        propuestaId,
        estado: propuesta.estado,
      });
    }
    return propuesta;
  }

  /** Actualiza la propuesta y la copia embebida en el mensaje del historial. */
  private guardarPropuesta(estado: EstadoBaseDatos, propuesta: PropuestaTicketDto): void {
    estado.propuestas[propuesta.id] = propuesta;
    const conversacion = estado.conversaciones[propuesta.conversacionId];
    if (!conversacion) {
      return;
    }
    conversacion.mensajes = conversacion.mensajes.map((mensaje) =>
      mensaje.rol === 'asistente'
        ? {
            ...mensaje,
            bloques: mensaje.bloques.map((bloque) =>
              bloque.tipo === 'propuesta-ticket' && bloque.propuesta.id === propuesta.id
                ? { ...bloque, propuesta }
                : bloque,
            ),
          }
        : mensaje,
    );
  }
}

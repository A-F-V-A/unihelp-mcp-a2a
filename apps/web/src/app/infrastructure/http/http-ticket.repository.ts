import { Injectable, inject } from '@angular/core';
import {
  type ConfirmarPropuestaTicketDto,
  type PropuestaTicketDto,
  RUTAS_API,
  type SolicitarPropuestaTicketDto,
  type TicketDto,
} from '@unihelp/contratos';
import type {
  ConfirmacionExplicita,
  PropuestaTicket,
  SolicitudPropuestaTicket,
  Ticket,
} from '../../domain/models/ticket';
import type { TicketRepository } from '../../domain/ports/ticket.repository';
import { mapearPropuestaTicket, mapearTicket } from '../mappers/ticket.mapper';
import { ClienteApi } from './cliente-api';

@Injectable()
export class HttpTicketRepository implements TicketRepository {
  private readonly api = inject(ClienteApi);

  async proponerTicket(solicitud: SolicitudPropuestaTicket): Promise<PropuestaTicket> {
    const cuerpo: SolicitarPropuestaTicketDto = { conversacionId: solicitud.conversacionId };
    const dto = await this.api.post<PropuestaTicketDto>(RUTAS_API.propuestasTicket, cuerpo);
    return mapearPropuestaTicket(dto);
  }

  async confirmarTicket(confirmacion: ConfirmacionExplicita): Promise<Ticket> {
    const cuerpo: ConfirmarPropuestaTicketDto = { confirmacionExplicita: true };
    const dto = await this.api.post<TicketDto>(
      RUTAS_API.confirmarPropuesta(confirmacion.propuestaId),
      cuerpo,
    );
    return mapearTicket(dto);
  }

  async rechazarTicket(propuestaId: string): Promise<PropuestaTicket> {
    const dto = await this.api.post<PropuestaTicketDto>(RUTAS_API.rechazarPropuesta(propuestaId));
    return mapearPropuestaTicket(dto);
  }
}

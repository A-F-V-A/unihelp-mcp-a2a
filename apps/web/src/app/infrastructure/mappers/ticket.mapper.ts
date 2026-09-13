import type { PropuestaTicketDto, TicketDto } from '@unihelp/contratos';
import type { PropuestaTicket, Ticket } from '../../domain/models/ticket';

export function mapearPropuestaTicket(dto: PropuestaTicketDto): PropuestaTicket {
  return {
    id: dto.id,
    conversacionId: dto.conversacionId,
    servicio: dto.servicio,
    categoria: dto.categoria,
    prioridad: dto.prioridad,
    resumen: dto.resumen,
    descripcion: dto.descripcion,
    estado: dto.estado,
    creadaEn: new Date(dto.creadaEn),
    resueltaEn: dto.resueltaEn ? new Date(dto.resueltaEn) : null,
    ticketNumero: dto.ticketNumero,
  };
}

export function mapearTicket(dto: TicketDto): Ticket {
  return {
    numero: dto.numero,
    propuestaId: dto.propuestaId,
    conversacionId: dto.conversacionId,
    servicio: dto.servicio,
    categoria: dto.categoria,
    prioridad: dto.prioridad,
    estado: dto.estado,
    creadoEn: new Date(dto.creadoEn),
    atencionEstimada: dto.atencionEstimada,
  };
}

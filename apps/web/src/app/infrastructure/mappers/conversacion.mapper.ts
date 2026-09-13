import type {
  BloqueRespuestaDto,
  HistorialConversacionDto,
  MensajeAsistenteDto,
  MensajeDto,
  MensajeUsuarioDto,
  RespuestaMensajeDto,
  ResumenConversacionDto,
} from '@unihelp/contratos';
import type {
  BloqueRespuesta,
  HistorialConversacion,
  Mensaje,
  MensajeAsistente,
  MensajeUsuario,
  RespuestaMensaje,
  ResumenConversacion,
} from '../../domain/models/conversacion';
import { mapearCitaPolitica } from './politica.mapper';
import { mapearEstadoServicio } from './servicio.mapper';
import { mapearPropuestaTicket, mapearTicket } from './ticket.mapper';

export function mapearBloque(dto: BloqueRespuestaDto): BloqueRespuesta {
  switch (dto.tipo) {
    case 'texto':
      return { tipo: 'texto', texto: dto.texto };
    case 'politicas':
      return { tipo: 'politicas', politicas: dto.politicas.map(mapearCitaPolitica) };
    case 'estado-servicio':
      return { tipo: 'estado-servicio', estado: mapearEstadoServicio(dto.estado) };
    case 'aviso-mantenimiento':
      return { tipo: 'aviso-mantenimiento', estado: mapearEstadoServicio(dto.estado) };
    case 'fuera-de-alcance':
      return { tipo: 'fuera-de-alcance', motivo: dto.motivo, canal: { ...dto.canal } };
    case 'propuesta-ticket':
      return { tipo: 'propuesta-ticket', propuesta: mapearPropuestaTicket(dto.propuesta) };
    case 'ticket-creado':
      return { tipo: 'ticket-creado', ticket: mapearTicket(dto.ticket) };
  }
}

export function mapearMensajeUsuario(dto: MensajeUsuarioDto): MensajeUsuario {
  return {
    id: dto.id,
    rol: 'usuario',
    turno: dto.turno,
    texto: dto.texto,
    enviadoEn: new Date(dto.enviadoEn),
  };
}

export function mapearMensajeAsistente(dto: MensajeAsistenteDto): MensajeAsistente {
  return {
    id: dto.id,
    rol: 'asistente',
    turno: dto.turno,
    clasificacion: dto.clasificacion ? { ...dto.clasificacion } : null,
    bloques: dto.bloques.map(mapearBloque),
    enviadoEn: new Date(dto.enviadoEn),
  };
}

export function mapearMensaje(dto: MensajeDto): Mensaje {
  return dto.rol === 'usuario' ? mapearMensajeUsuario(dto) : mapearMensajeAsistente(dto);
}

export function mapearRespuestaMensaje(dto: RespuestaMensajeDto): RespuestaMensaje {
  return {
    conversacionId: dto.conversacionId,
    conversacion: mapearResumenConversacion(dto.conversacion),
    mensajeUsuario: mapearMensajeUsuario(dto.mensajeUsuario),
    respuesta: mapearMensajeAsistente(dto.respuesta),
    turnos: { ...dto.turnos },
    accionSugerida: dto.accionSugerida,
  };
}

export function mapearResumenConversacion(dto: ResumenConversacionDto): ResumenConversacion {
  return {
    id: dto.id,
    titulo: dto.titulo,
    creadaEn: new Date(dto.creadaEn),
    actualizadaEn: new Date(dto.actualizadaEn),
    turnos: { ...dto.turnos },
  };
}

export function mapearHistorial(dto: HistorialConversacionDto): HistorialConversacion {
  return {
    conversacionId: dto.conversacionId,
    mensajes: dto.mensajes.map(mapearMensaje),
    turnos: { ...dto.turnos },
  };
}

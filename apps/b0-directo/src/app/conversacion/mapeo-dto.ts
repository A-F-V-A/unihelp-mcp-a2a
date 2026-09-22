/**
 * Traduccion de los modelos de las librerias a los DTO del contrato de red
 * (`libs/contratos`). Solo forma: ninguna regla de negocio vive aqui.
 */
import type {
  CitaPoliticaDto,
  EstadoServicioDto,
  PoliticaDto,
  PropuestaTicketDto,
  TicketDto,
} from '@unihelp/contratos';
import type {
  ComponentesDeServicio,
  PoliticaCompleta,
  PoliticaEncontrada,
  Servicio,
} from '@unihelp/conocimiento';
import type { AreaServicio } from '@unihelp/dominio';
import { PRIORIDAD_DOMINIO, type Propuesta, type Ticket } from '@unihelp/tickets';

const ALCANCE_LEGIBLE: Readonly<Record<string, string>> = {
  total: 'Todos los usuarios del servicio',
  parcial: 'Parte de los usuarios del servicio',
  programado: 'Mantenimiento programado',
};

export function aEstadoServicioDto(resultado: ComponentesDeServicio): EstadoServicioDto {
  const { servicio, estado, componentes } = resultado;
  const afectados = componentes.filter((c) => c.estado !== 'operativo').map((c) => c.nombre);
  return {
    servicio: servicio.area,
    nombre: servicio.nombre,
    estado: estado.estado,
    componenteAfectado: afectados.length > 0 ? afectados.join(', ') : null,
    alcance: estado.alcance === null ? null : (ALCANCE_LEGIBLE[estado.alcance] ?? estado.alcance),
    ventanaEstimada: estado.ventanaEstimada,
    incidenteId: estado.incidenteRef,
    actualizadoEn: estado.desde,
  };
}

export function aCitaPoliticaDto(
  politica: PoliticaEncontrada,
  area: AreaServicio,
): CitaPoliticaDto {
  return {
    codigo: politica.codigo,
    version: politica.version,
    titulo: politica.titulo,
    extracto: politica.extracto.texto,
    area,
  };
}

export function aPoliticaDto(completa: PoliticaCompleta, area: AreaServicio): PoliticaDto {
  const { politica, version, extractos } = completa;
  return {
    codigo: politica.codigo,
    version: version.version,
    titulo: version.titulo,
    extracto: extractos[0]?.texto ?? '',
    area,
    contenido: extractos.map((e) => e.texto),
    vigenteDesde: version.vigenteDesde,
    dependenciaResponsable: politica.dependenciaResponsable,
    enlace: politica.enlace,
  };
}

export function aPropuestaTicketDto(propuesta: Propuesta, servicio: Servicio): PropuestaTicketDto {
  return {
    id: propuesta.id,
    conversacionId: propuesta.conversacionId,
    servicio: servicio.area,
    categoria: propuesta.categoria,
    prioridad: PRIORIDAD_DOMINIO[propuesta.prioridad],
    resumen: propuesta.resumen,
    descripcion: propuesta.descripcion,
    estado: propuesta.estado,
    creadaEn: propuesta.creadaEn.toISOString(),
    resueltaEn: propuesta.resueltaEn?.toISOString() ?? null,
    ticketNumero: propuesta.ticketNumero,
  };
}

export function aTicketDto(ticket: Ticket, servicio: Servicio): TicketDto {
  return {
    numero: ticket.numero,
    propuestaId: ticket.propuestaId,
    conversacionId: ticket.conversacionId,
    servicio: servicio.area,
    categoria: ticket.categoria,
    prioridad: PRIORIDAD_DOMINIO[ticket.prioridad],
    estado: ticket.estado,
    creadoEn: ticket.creadoEn.toISOString(),
    atencionEstimada: null,
  };
}

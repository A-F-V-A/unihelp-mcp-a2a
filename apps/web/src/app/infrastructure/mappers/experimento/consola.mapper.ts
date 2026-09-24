import type {
  EstadoConsolaDto,
  EventoTrabajoDto,
  LineaTrabajoDto,
  TrabajoDto,
} from '@unihelp/contratos';
import type {
  EstadoConsola,
  EventoTrabajo,
  LineaTrabajo,
  Trabajo,
} from '../../../domain/models/experimento/trabajo-consola';

export function mapearLineaTrabajo(dto: LineaTrabajoDto): LineaTrabajo {
  return { numero: dto.numero, origen: dto.origen, texto: dto.texto, en: new Date(dto.en) };
}

export function mapearTrabajo(dto: TrabajoDto): Trabajo {
  return {
    id: dto.id,
    tipo: dto.tipo,
    estado: dto.estado,
    comando: dto.comando,
    corrida: dto.corrida,
    iniciadoEn: new Date(dto.iniciadoEn),
    terminadoEn: dto.terminadoEn ? new Date(dto.terminadoEn) : null,
    codigoSalida: dto.codigoSalida,
    lineas: dto.lineas.map(mapearLineaTrabajo),
  };
}

export function mapearEstadoConsola(dto: EstadoConsolaDto): EstadoConsola {
  return {
    trabajo: dto.trabajo ? mapearTrabajo(dto.trabajo) : null,
    ejecutable: dto.ejecutable,
    directorioExperimento: dto.directorioExperimento,
  };
}

export function mapearEventoTrabajo(dto: EventoTrabajoDto): EventoTrabajo {
  return dto.tipo === 'linea'
    ? { tipo: 'linea', linea: mapearLineaTrabajo(dto.linea) }
    : { tipo: 'fin', trabajo: mapearTrabajo(dto.trabajo) };
}

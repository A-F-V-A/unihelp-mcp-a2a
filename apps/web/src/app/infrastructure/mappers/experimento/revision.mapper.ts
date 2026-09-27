import type {
  AdjudicacionDto,
  CalificacionDto,
  DesacuerdoDto,
  EstadoAdjudicacionDto,
  ItemRevisionDto,
  MuestraRevisionDto,
  ProgresoRevisorDto,
} from '@unihelp/contratos';
import type {
  Adjudicacion,
  Calificacion,
  Desacuerdo,
  EstadoAdjudicacion,
  ItemRevision,
  MuestraRevision,
  ProgresoRevisor,
} from '../../../domain/models/experimento/revision-humana';

export function mapearItemRevision(dto: ItemRevisionDto): ItemRevision {
  return {
    id: dto.id,
    tarea: dto.tarea,
    dialogo: dto.dialogo.map((t) => ({ rol: t.rol, texto: t.texto })),
    respuestaFinal: dto.respuestaFinal,
    puntosClave: [...dto.puntosClave],
    prohibiciones: [...dto.prohibiciones],
    informacionRecuperada: dto.informacionRecuperada.map((i) => ({
      herramienta: i.herramienta,
      resultado: i.resultado,
    })),
  };
}

export function mapearMuestraRevision(dto: MuestraRevisionDto): MuestraRevision {
  return { version: dto.version, items: dto.items.map(mapearItemRevision) };
}

export function mapearCalificacion(dto: CalificacionDto): Calificacion {
  return {
    rol: dto.rol,
    revisor: dto.revisor,
    itemId: dto.itemId,
    puntosCubiertos: [...dto.puntosCubiertos],
    prohibicionesVioladas: [...dto.prohibicionesVioladas],
    veredicto: dto.veredicto,
    comentario: dto.comentario,
    guardadaEn: new Date(dto.guardadaEn),
  };
}

export function mapearProgresoRevisor(dto: ProgresoRevisorDto): ProgresoRevisor {
  return {
    rol: dto.rol,
    revisor: dto.revisor,
    total: dto.total,
    calificaciones: dto.calificaciones.map(mapearCalificacion),
  };
}

function mapearDesacuerdo(dto: DesacuerdoDto): Desacuerdo {
  return {
    item: mapearItemRevision(dto.item),
    revisorA: mapearCalificacion(dto.revisorA),
    revisorB: mapearCalificacion(dto.revisorB),
    adjudicado: dto.adjudicado,
  };
}

export function mapearEstadoAdjudicacion(dto: EstadoAdjudicacionDto): EstadoAdjudicacion {
  return {
    disponible: dto.disponible,
    calificadasA: dto.calificadasA,
    calificadasB: dto.calificadasB,
    total: dto.total,
    acuerdos: dto.acuerdos,
    desacuerdos: dto.desacuerdos.map(mapearDesacuerdo),
  };
}

export function mapearAdjudicacion(dto: AdjudicacionDto): Adjudicacion {
  return {
    itemId: dto.itemId,
    veredicto: dto.veredicto,
    motivo: dto.motivo,
    guardadaEn: new Date(dto.guardadaEn),
  };
}

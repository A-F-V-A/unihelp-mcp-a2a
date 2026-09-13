import type { EstadoServicioDto } from '@unihelp/contratos';
import type { EstadoServicio } from '../../domain/models/servicio';

export function mapearEstadoServicio(dto: EstadoServicioDto): EstadoServicio {
  return {
    servicio: dto.servicio,
    nombre: dto.nombre,
    estado: dto.estado,
    componenteAfectado: dto.componenteAfectado,
    alcance: dto.alcance,
    ventanaEstimada: dto.ventanaEstimada
      ? { inicio: new Date(dto.ventanaEstimada.inicio), fin: new Date(dto.ventanaEstimada.fin) }
      : null,
    incidenteId: dto.incidenteId,
    actualizadoEn: new Date(dto.actualizadoEn),
  };
}

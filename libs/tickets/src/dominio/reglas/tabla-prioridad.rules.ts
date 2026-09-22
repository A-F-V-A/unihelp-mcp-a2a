import type { NivelEstadoServicio } from '@unihelp/dominio';
import type {
  AlcanceTicket,
  CodigoPrioridad,
  ContextoServicio,
  NivelServicioTicket,
} from '../prioridad';

/** Con el servicio en mantenimiento programado no se crea ticket: se informa la ventana (HU-12). */
export const SIN_TICKET = 'sin-ticket';

export type ResultadoTabla = CodigoPrioridad | typeof SIN_TICKET | null;

/**
 * Tabla institucional de prioridad de docs/01, F-3, fila por fila. `interrumpido`
 * es el `FUERA_DE_SERVICIO` del anexo (decision 16).
 *
 * Devuelve `null` en las combinaciones que la tabla no cubre (por ejemplo, un
 * servicio de nivel medio fuera de servicio para todos). NUNCA inventa una
 * prioridad para ellas: ninguna variante de la semilla las produce (DP-02).
 */
export function prioridadSegunTabla(
  estado: NivelEstadoServicio,
  alcance: AlcanceTicket,
  nivel: NivelServicioTicket,
): ResultadoTabla {
  switch (estado) {
    case 'mantenimiento':
      return SIN_TICKET;
    case 'interrumpido':
      if (alcance === 'total') {
        return nivel === 'critico' || nivel === 'alto' ? 'P1' : null;
      }
      return alcance === 'parcial' ? 'P2' : null;
    case 'degradado':
      if (alcance === 'total') {
        return nivel === 'critico' ? 'P2' : null;
      }
      return alcance === 'parcial' || alcance === 'individual' ? 'P3' : null;
    case 'operativo':
      // Con el servicio operativo el problema es de la persona, no del servicio.
      return 'P4';
  }
}

/**
 * Prioridades que un ticket puede tener sobre este servicio. Son dos lecturas
 * posibles: la afectacion publicada, o que el sintoma no toque un componente
 * afectado y el caso sea individual. Cual aplica lo decide el diagnostico del
 * modelo; el codigo solo impide una prioridad que ninguna fila respalde (HU-11).
 */
export function prioridadesAdmisibles(servicio: ContextoServicio): readonly CodigoPrioridad[] {
  const lecturas: AlcanceTicket[] = [servicio.alcance ?? 'individual', 'individual'];
  const admisibles = new Set<CodigoPrioridad>();
  for (const alcance of lecturas) {
    const resultado = prioridadSegunTabla(servicio.estado, alcance, servicio.nivelServicio);
    if (resultado !== null && resultado !== SIN_TICKET) {
      admisibles.add(resultado);
    }
  }
  return [...admisibles].sort();
}

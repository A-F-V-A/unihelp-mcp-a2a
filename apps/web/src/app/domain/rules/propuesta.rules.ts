import type { PropuestaTicket } from '../models/ticket';

/**
 * Una propuesta solo admite una resolucion. Confirmada o rechazada, queda
 * cerrada: una propuesta descartada no se puede volver a confirmar (HU-FE-18).
 */
export function propuestaPendiente(propuesta: PropuestaTicket): boolean {
  return propuesta.estado === 'pendiente';
}

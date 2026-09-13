import type {
  MensajeDto,
  PropuestaTicketDto,
  ResumenConversacionDto,
  TicketDto,
} from '@unihelp/contratos';
import { SECUENCIA_INICIAL_TICKET } from './fixtures/tickets.fixture';
import type { BorradorPropuesta } from './fixtures/tipos';

export interface RegistroConversacion {
  readonly id: string;
  titulo: string;
  /** ISO 8601. */
  readonly creadaEn: string;
  /** ISO 8601 del ultimo mensaje. */
  actualizadaEn: string;
  mensajes: MensajeDto[];
  turnosUsados: number;
  /** Ultimo escenario tratado: da contexto a los mensajes de seguimiento. */
  ultimoEscenarioId: string | null;
  /** Diagnostico que respalda una futura propuesta de ticket. */
  borradorPropuesta: BorradorPropuesta | null;
}

export interface EstadoBaseDatos {
  conversaciones: Record<string, RegistroConversacion>;
  propuestas: Record<string, PropuestaTicketDto>;
  tickets: Record<string, TicketDto>;
  /** Borrador que origino cada propuesta: define con que estado nace su ticket. */
  borradoresPorPropuesta: Record<string, BorradorPropuesta>;
  secuencia: number;
  secuenciaTicket: number;
}

export function estadoInicial(): EstadoBaseDatos {
  return {
    conversaciones: {},
    propuestas: {},
    tickets: {},
    borradoresPorPropuesta: {},
    secuencia: 0,
    secuenciaTicket: SECUENCIA_INICIAL_TICKET,
  };
}

export function generarId(estado: EstadoBaseDatos, prefijo: string): string {
  estado.secuencia += 1;
  return `${prefijo}-${Date.now().toString(36)}-${estado.secuencia}`;
}

export function resumirConversacion(
  conversacion: RegistroConversacion,
  turnosMaximos: number,
): ResumenConversacionDto {
  return {
    id: conversacion.id,
    titulo: conversacion.titulo,
    creadaEn: conversacion.creadaEn,
    actualizadaEn: conversacion.actualizadaEn,
    turnos: { usados: conversacion.turnosUsados, maximos: turnosMaximos },
  };
}

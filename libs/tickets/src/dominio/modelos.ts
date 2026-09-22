/**
 * Modelos del registro controlado de tickets (HU-13 a HU-17). Solo tipos: la
 * logica vive en las reglas y los casos de uso.
 */
import type { EstadoIncidente, EstadoPropuestaTicket } from '@unihelp/dominio';
import type { CodigoPrioridad } from './prioridad';

/** Categorias de ticket del esquema de `proponer_ticket` (docs/02, 2.3). */
export const CATEGORIAS_TICKET = [
  'acceso',
  'rendimiento',
  'error_funcional',
  'datos',
  'otro',
] as const;

export type CategoriaTicket = (typeof CATEGORIAS_TICKET)[number];

/** Minutos que una propuesta admite confirmacion (RN-08). */
export const VIGENCIA_PROPUESTA_MINUTOS = 15;

/** Turno escrito por la persona, registrado ANTES de que el modelo lo vea (DP-05). */
export interface TurnoUsuario {
  readonly conversacionId: string;
  readonly texto: string;
  readonly registradoEn: Date;
}

/** Propuesta efimera: todavia no es un ticket (HU-13). */
export interface Propuesta {
  readonly id: string;
  readonly conversacionId: string;
  readonly traceId: string;
  readonly servicio: string;
  readonly categoria: CategoriaTicket;
  readonly prioridad: CodigoPrioridad;
  readonly resumen: string;
  readonly descripcion: string;
  /** Identificador sintetico: el sistema no autentica personas (docs/08, seccion 20). */
  readonly solicitante: string;
  /** Texto que el agente debe mostrar antes de pedir confirmacion. */
  readonly resumenLegible: string;
  /** Si no esta vacia, la propuesta no se puede confirmar (RN-04). */
  readonly camposFaltantes: readonly string[];
  readonly estado: EstadoPropuestaTicket;
  readonly creadaEn: Date;
  readonly expiraEn: Date;
  readonly resueltaEn: Date | null;
  readonly ticketNumero: string | null;
}

/** Confirmacion registrada. Del token solo se guarda su huella, nunca el valor. */
export interface Confirmacion {
  readonly propuestaId: string;
  readonly tokenHash: string;
  /** `usuario-conversacion` (turno escrito) o `usuario-interfaz` (boton del frontend). */
  readonly via: 'usuario-conversacion' | 'usuario-interfaz';
  /** Texto literal que confirmo, o `null` si fue la accion explicita del boton. */
  readonly texto: string | null;
  readonly confirmadaEn: Date;
  readonly expiraEn: Date;
}

/** Ticket creado. Formato institucional del contrato: `UH-2026-001208` (HU-17). */
export interface Ticket {
  readonly numero: string;
  readonly propuestaId: string;
  readonly conversacionId: string;
  readonly traceId: string;
  readonly servicio: string;
  readonly categoria: CategoriaTicket;
  readonly prioridad: CodigoPrioridad;
  readonly estado: EstadoIncidente;
  readonly creadoEn: Date;
}

/** Resultado de un evento de auditoria (docs/01, 4.6). */
export type ResultadoAuditoria = 'OK' | 'RECHAZADO' | 'ERROR';

/**
 * Evento del registro de solo agregar (HU-35, RM-09). Guarda la huella del
 * cuerpo, nunca el cuerpo.
 */
export interface EventoAuditoria {
  readonly traceId: string;
  /** Quien actua: `b0-agent`, `usuario-interfaz`... */
  readonly actor: string;
  /** Ej.: `ticket.create`, `herramienta.buscar_politica`. */
  readonly accion: string;
  readonly recurso: string;
  readonly resultado: ResultadoAuditoria;
  /** Obligatorio si el resultado no es `OK`. */
  readonly motivo: string | null;
  /** Solo en `ticket.create`: si el token presentado era valido (M5.1). */
  readonly tokenValido: boolean | null;
  /** `sha256:<hex>` del cuerpo de la peticion. */
  readonly payloadHash: string;
}

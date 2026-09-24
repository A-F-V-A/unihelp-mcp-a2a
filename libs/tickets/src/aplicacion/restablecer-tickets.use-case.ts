import { Inject, Injectable } from '@nestjs/common';
import type { TicketsRepository } from '../dominio/puertos/tickets.repository';
import { RESTABLECIMIENTO_TICKETS_PERMITIDO, TICKETS_REPOSITORY } from './tokens';

/**
 * No extiende `ErrorTickets` a proposito: sus codigos son los de las cinco
 * herramientas (docs/02, seccion 5) y este error nunca llega a una herramienta,
 * solo al ejecutor del experimento.
 */
export class RestablecimientoTicketsNoPermitidoError extends Error {
  constructor() {
    super('El restablecimiento de tickets solo está disponible con UNIHELP_PERFIL=experimento.');
    this.name = new.target.name;
  }
}

export interface ResultadoRestablecimientoTickets {
  /** Tablas del esquema `tickets` que quedaron vacias. */
  readonly vaciadas: readonly string[];
  /** Siempre `false`: la auditoria nunca se restablece (HU-35, RM-09). */
  readonly auditoriaVaciada: false;
}

const TABLAS_VACIADAS = [
  'tickets.turnos_usuario',
  'tickets.propuestas',
  'tickets.confirmaciones',
  'tickets.tickets',
] as const;

/**
 * Deja el registro de tickets como estaba antes de la primera ejecucion, para
 * que ninguna ejecucion del experimento vea propuestas ni tickets de la
 * anterior (decision 31). Es el equivalente en tickets de
 * `RestablecerConocimientoUseCase`, con dos diferencias deliberadas:
 *
 * - **No toca `auditoria`.** Es de solo agregar y es la fuente independiente
 *   contra la que se verifican las escrituras no autorizadas (HU-35, M5.1).
 * - **No devuelve huella.** El estado vacio no participa de
 *   `provenance.state_hash_inicial`, que hoy cubre solo la base de conocimiento
 *   (DP-15 sigue abierta en `apps/b0-directo/docs/ARQUITECTURA.md`).
 *
 * Igual que el de conocimiento, solo se registra en el perfil de experimento o
 * de pruebas, y aun asi se verifica aqui.
 */
@Injectable()
export class RestablecerTicketsUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly repositorio: TicketsRepository,
    @Inject(RESTABLECIMIENTO_TICKETS_PERMITIDO) private readonly permitido: boolean,
  ) {}

  /** @throws RestablecimientoTicketsNoPermitidoError fuera del perfil, sin tocar la base. */
  async ejecutar(): Promise<ResultadoRestablecimientoTickets> {
    if (!this.permitido) {
      throw new RestablecimientoTicketsNoPermitidoError();
    }
    await this.repositorio.vaciarRegistro();
    return { vaciadas: TABLAS_VACIADAS, auditoriaVaciada: false };
  }
}

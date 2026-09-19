import { Inject, Injectable } from '@nestjs/common';
import type { TicketsRepository } from '../dominio/puertos/tickets.repository';
import { RELOJ_TICKETS, type RelojTickets, TICKETS_REPOSITORY } from './tokens';

/**
 * Registra el texto literal que escribio la persona, ANTES de que el modelo lo
 * vea. Es la prueba de que una confirmacion viene de un turno real: el modelo no
 * puede fabricar una fila aqui (T-ADV-007; DP-05 de la arquitectura de B0).
 */
@Injectable()
export class RegistrarTurnoUseCase {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly repositorio: TicketsRepository,
    @Inject(RELOJ_TICKETS) private readonly reloj: RelojTickets,
  ) {}

  async ejecutar(conversacionId: string, texto: string): Promise<void> {
    await this.repositorio.registrarTurno({
      conversacionId,
      texto,
      registradoEn: this.reloj.ahora(),
    });
  }
}

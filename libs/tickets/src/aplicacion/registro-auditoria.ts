import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ResultadoAuditoria } from '../dominio/modelos';
import type { TicketsRepository } from '../dominio/puertos/tickets.repository';
import { TICKETS_REPOSITORY } from './tokens';

/** Lo que se quiere auditar. El cuerpo se reduce a su huella antes de guardarse. */
export interface SolicitudAuditoria {
  readonly traceId: string;
  readonly actor: string;
  readonly accion: string;
  readonly recurso: string;
  readonly resultado: ResultadoAuditoria;
  readonly motivo?: string | null;
  readonly tokenValido?: boolean | null;
  readonly cuerpo: unknown;
}

/** `sha256:<hex>` de la serializacion JSON del cuerpo. */
export function huellaCuerpo(cuerpo: unknown): string {
  const texto = JSON.stringify(cuerpo ?? null) ?? 'null';
  return `sha256:${createHash('sha256').update(texto, 'utf8').digest('hex')}`;
}

/**
 * Unica puerta de escritura al registro de auditoria (HU-35, RM-09). Guarda la
 * huella del cuerpo y NUNCA el cuerpo: el registro no acumula datos de la persona.
 */
@Injectable()
export class RegistroAuditoria {
  constructor(@Inject(TICKETS_REPOSITORY) private readonly repositorio: TicketsRepository) {}

  async registrar(solicitud: SolicitudAuditoria): Promise<void> {
    await this.repositorio.registrarEvento({
      traceId: solicitud.traceId,
      actor: solicitud.actor,
      accion: solicitud.accion,
      recurso: solicitud.recurso,
      resultado: solicitud.resultado,
      motivo: solicitud.motivo ?? null,
      tokenValido: solicitud.tokenValido ?? null,
      payloadHash: huellaCuerpo(solicitud.cuerpo),
    });
  }
}

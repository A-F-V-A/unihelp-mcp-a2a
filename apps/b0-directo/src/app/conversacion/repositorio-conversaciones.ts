import { Injectable } from '@nestjs/common';
import type { MensajeDto } from '@unihelp/contratos';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/** Una conversacion: lo que ve la persona y lo que ve el modelo, por separado. */
export interface Conversacion {
  readonly id: string;
  readonly titulo: string;
  readonly traceId: string;
  readonly creadaEn: Date;
  actualizadaEn: Date;
  /** Mensajes del contrato de red, en orden cronologico. */
  mensajes: MensajeDto[];
  /** Historial en el protocolo del modelo, con los mensajes de rol de herramienta (HU-04). */
  historialModelo: ChatCompletionMessageParam[];
}

/**
 * Historial de conversaciones en la memoria del proceso: cada conversacion esta
 * aislada de las demas (HU-04, RNF-03). Se pierde al reiniciar B0; la
 * persistencia no afecta a ninguna metrica y queda para cuando haga falta.
 */
@Injectable()
export class RepositorioConversaciones {
  private readonly conversaciones = new Map<string, Conversacion>();

  obtener(id: string): Conversacion | undefined {
    return this.conversaciones.get(id);
  }

  guardar(conversacion: Conversacion): void {
    this.conversaciones.set(conversacion.id, conversacion);
  }

  eliminar(id: string): boolean {
    return this.conversaciones.delete(id);
  }

  /** De la mas reciente a la mas antigua; desempate por id en orden binario (RM-10). */
  listar(): readonly Conversacion[] {
    return [...this.conversaciones.values()].sort(
      (a, b) =>
        b.actualizadaEn.getTime() - a.actualizadaEn.getTime() ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  }
}

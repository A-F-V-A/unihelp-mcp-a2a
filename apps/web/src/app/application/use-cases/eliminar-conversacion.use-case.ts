import { Injectable, inject } from '@angular/core';
import { CHAT_REPOSITORY } from '../di/tokens';

@Injectable({ providedIn: 'root' })
export class EliminarConversacionUseCase {
  private readonly chat = inject(CHAT_REPOSITORY);

  ejecutar(conversacionId: string): Promise<void> {
    return this.chat.eliminarConversacion(conversacionId);
  }
}

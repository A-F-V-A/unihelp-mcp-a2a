import { Injectable, inject } from '@angular/core';
import type { ResumenConversacion } from '../../domain/models/conversacion';
import { CHAT_REPOSITORY } from '../di/tokens';

@Injectable({ providedIn: 'root' })
export class ListarConversacionesUseCase {
  private readonly chat = inject(CHAT_REPOSITORY);

  async ejecutar(): Promise<readonly ResumenConversacion[]> {
    const conversaciones = await this.chat.listarConversaciones();
    return [...conversaciones].sort(
      (a, b) => b.actualizadaEn.getTime() - a.actualizadaEn.getTime(),
    );
  }
}

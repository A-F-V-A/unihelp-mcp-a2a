import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Cabecera flotante: menu, identidad con el turno actual y nueva conversacion. */
@Component({
  selector: 'app-chat-header',
  templateUrl: './chat-header.html',
  styleUrl: './chat-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatHeader {
  /** Ej.: "Turno 2 de 8"; `null` antes del primer mensaje. */
  readonly turnos = input<string | null>(null);
  readonly nuevaDeshabilitada = input(false);

  readonly abrirMenu = output<void>();
  readonly abrirAcerca = output<void>();
  readonly nuevaConversacion = output<void>();
}

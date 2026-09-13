import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Aviso de limite de turnos alcanzado (RNF-04). Reemplaza al campo de escritura. */
@Component({
  selector: 'app-turn-limit-notice',
  templateUrl: './turn-limit-notice.html',
  styleUrl: './turn-limit-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnLimitNotice {
  readonly turnosMaximos = input.required<number>();
  readonly nuevaConversacion = output<void>();
}

import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Indica que el mensaje se recibio y la respuesta esta en camino (HU-FE-08). */
@Component({
  selector: 'app-typing-indicator',
  templateUrl: './typing-indicator.html',
  styleUrl: './typing-indicator.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypingIndicator {}

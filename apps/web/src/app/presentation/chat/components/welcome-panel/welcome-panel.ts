import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Estado vacio de la conversacion, con solicitudes de ejemplo para arrancar. */
@Component({
  selector: 'app-welcome-panel',
  templateUrl: './welcome-panel.html',
  styleUrl: './welcome-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomePanel {
  readonly ejemplos = input.required<readonly string[]>();
  readonly deshabilitado = input(false);
  readonly elegir = output<string>();
}

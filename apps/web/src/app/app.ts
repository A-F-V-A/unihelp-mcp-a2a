import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModeloIAStore } from './application/state/modelo-ia.store';
import { PreferenciasStore } from './application/state/preferencias.store';
import { aplicarApariencia } from './presentation/shared/apariencia';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    const preferencias = inject(PreferenciasStore);
    void preferencias.iniciar();
    // Tema y tamano de texto afectan al documento completo, no a un componente.
    effect(() => aplicarApariencia(preferencias.preferencias()));

    void inject(ModeloIAStore).iniciar();
  }
}

import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ModeloIAStore } from './application/state/modelo-ia.store';
import { PreferenciasStore } from './application/state/preferencias.store';
import { ChatPage } from './presentation/chat/chat-page/chat-page';
import { aplicarApariencia } from './presentation/shared/apariencia';

@Component({
  selector: 'app-root',
  imports: [ChatPage],
  template: '<app-chat-page />',
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

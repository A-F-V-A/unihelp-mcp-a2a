import type { Routes } from '@angular/router';
import { ChatPage } from './presentation/chat/chat-page/chat-page';

/**
 * Dos zonas: el chat de triaje (la app que ven las personas) y el panel del
 * experimento (lo que ve el investigador). El panel se carga aparte para que
 * el chat no pague su peso en el arranque (presupuesto inicial de 500 kB).
 */
export const APP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', component: ChatPage, title: 'UniHelp' },
  {
    path: 'experimento',
    loadChildren: () =>
      import('./presentation/experimento/experimento.routes').then((m) => m.EXPERIMENTO_ROUTES),
  },
  { path: '**', redirectTo: '' },
];

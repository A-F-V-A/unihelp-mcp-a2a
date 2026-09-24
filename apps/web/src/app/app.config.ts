import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { APP_ROUTES } from './app.routes';
import { provideDataLayer } from './infrastructure/provide-data-layer';
import { CONFIGURACION_APP, type ConfiguracionApp } from './nucleo/configuracion';

/**
 * La configuracion se resuelve antes del arranque (ver `main.ts`) y entra aqui
 * como valor, de modo que ningun componente conoce la URL del backend.
 */
export function crearAppConfig(configuracion: ConfiguracionApp): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideHttpClient(withFetch()),
      provideRouter(
        APP_ROUTES,
        withComponentInputBinding(),
        withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      ),
      { provide: CONFIGURACION_APP, useValue: configuracion },
      provideDataLayer(),
    ],
  };
}

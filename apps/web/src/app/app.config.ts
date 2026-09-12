import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
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
      { provide: CONFIGURACION_APP, useValue: configuracion },
    ],
  };
}

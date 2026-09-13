import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { environment } from '../environments/environment';
import { provideDataLayer } from './infrastructure/provide-data-layer';
import { CONFIGURACION_APP, type ConfiguracionApp } from './nucleo/configuracion';

/**
 * La configuracion se resuelve antes del arranque (ver `main.ts`) y entra aqui
 * como valor, de modo que ningun componente conoce la URL del backend.
 *
 * Tampoco sabe si el backend es real o simulado: eso lo decide
 * `provideDataLayer()` a partir de `USE_MOCK_BACKEND` del entorno.
 */
export function crearAppConfig(configuracion: ConfiguracionApp): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideHttpClient(withFetch()),
      { provide: CONFIGURACION_APP, useValue: configuracion },
      provideDataLayer({
        useMockBackend: environment.USE_MOCK_BACKEND,
        simulacion: environment.simulacion,
      }),
    ],
  };
}

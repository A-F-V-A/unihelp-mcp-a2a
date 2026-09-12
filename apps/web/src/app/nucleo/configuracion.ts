import { InjectionToken } from '@angular/core';

/**
 * Configuracion que el frontend resuelve EN TIEMPO DE EJECUCION, no en tiempo
 * de compilacion. Asi una sola imagen de `web` sirve para las cuatro
 * arquitecturas: lo unico que cambia es el `backendUrl` que inyecta Docker.
 */
export interface ConfiguracionApp {
  /** Origen del backend activo, sin barra final. Ej.: `http://localhost:3000`. */
  readonly backendUrl: string;
}

export const CONFIGURACION_APP = new InjectionToken<ConfiguracionApp>('CONFIGURACION_APP');

const RESPALDO: ConfiguracionApp = { backendUrl: 'http://localhost:3000' };

const normalizar = (url: string): string => url.trim().replace(/\/+$/, '');

/**
 * Carga `config.json` antes de arrancar Angular. El archivo se reescribe en el
 * arranque del contenedor a partir de la variable de entorno `BACKEND_URL`.
 *
 * Para desarrollo local se acepta ademas `?backend=http://localhost:3001`, que
 * permite apuntar el mismo frontend a otra arquitectura sin reconstruir nada.
 */
export async function cargarConfiguracion(): Promise<ConfiguracionApp> {
  const sobrescritura = new URLSearchParams(window.location.search).get('backend');
  if (sobrescritura) {
    return { backendUrl: normalizar(sobrescritura) };
  }

  try {
    const respuesta = await fetch('config.json', { cache: 'no-store' });
    if (!respuesta.ok) {
      return RESPALDO;
    }

    const crudo = (await respuesta.json()) as Partial<ConfiguracionApp>;
    return typeof crudo.backendUrl === 'string' && crudo.backendUrl.length > 0
      ? { backendUrl: normalizar(crudo.backendUrl) }
      : RESPALDO;
  } catch {
    // Sin config.json disponible se cae al valor de desarrollo.
    return RESPALDO;
  }
}

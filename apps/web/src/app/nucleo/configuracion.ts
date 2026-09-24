import { InjectionToken } from '@angular/core';

/**
 * Configuracion que el frontend resuelve EN TIEMPO DE EJECUCION, no en tiempo
 * de compilacion. Asi una sola imagen de `web` sirve para las cuatro
 * arquitecturas: lo unico que cambia es el `backendUrl` que inyecta Docker.
 */
export interface ConfiguracionApp {
  /** Origen del backend activo, sin barra final. Ej.: `http://localhost:3000`. */
  readonly backendUrl: string;
  /**
   * Origen de la consola del experimento (`apps/consola-experimento`), sin
   * barra final. Solo la usa el panel para lanzar corridas (decision 39); si no
   * responde, el panel sigue en solo lectura.
   */
  readonly consolaUrl: string;
}

export const CONFIGURACION_APP = new InjectionToken<ConfiguracionApp>('CONFIGURACION_APP');

const RESPALDO: ConfiguracionApp = {
  backendUrl: 'http://localhost:3000',
  consolaUrl: 'http://localhost:3030',
};

const normalizar = (url: string): string => url.trim().replace(/\/+$/, '');

/**
 * Carga `config.json` antes de arrancar Angular. El archivo se reescribe en el
 * arranque del contenedor a partir de la variable de entorno `BACKEND_URL`.
 *
 * Para desarrollo local se acepta ademas `?backend=http://localhost:3001`, que
 * permite apuntar el mismo frontend a otra arquitectura sin reconstruir nada,
 * y `?consola=http://localhost:3030` para la consola del experimento.
 */
export async function cargarConfiguracion(): Promise<ConfiguracionApp> {
  const parametros = new URLSearchParams(window.location.search);
  const sobrescrituraBackend = parametros.get('backend');
  const sobrescrituraConsola = parametros.get('consola');

  let cargada: ConfiguracionApp = RESPALDO;
  try {
    const respuesta = await fetch('config.json', { cache: 'no-store' });
    if (respuesta.ok) {
      const crudo = (await respuesta.json()) as Partial<ConfiguracionApp>;
      cargada = {
        backendUrl:
          typeof crudo.backendUrl === 'string' && crudo.backendUrl.length > 0
            ? normalizar(crudo.backendUrl)
            : RESPALDO.backendUrl,
        consolaUrl:
          typeof crudo.consolaUrl === 'string' && crudo.consolaUrl.length > 0
            ? normalizar(crudo.consolaUrl)
            : RESPALDO.consolaUrl,
      };
    }
  } catch {
    // Sin config.json disponible se cae al valor de desarrollo.
  }

  return {
    backendUrl: sobrescrituraBackend ? normalizar(sobrescrituraBackend) : cargada.backendUrl,
    consolaUrl: sobrescrituraConsola ? normalizar(sobrescrituraConsola) : cargada.consolaUrl,
  };
}

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carga el `.env` de una app en desarrollo, ANTES de que se lea su configuracion.
 * Se hace aqui y no se delega en Nx porque Nx no entrega de forma fiable las
 * variables del archivo al proceso hijo: una variable agregada al `.env` no
 * llegaba al servidor en marcha.
 *
 * `UNIHELP_ARCHIVO_ENV` permite apuntar a otro archivo. En la imagen Docker no
 * hay `.env` y esto no hace nada: alli las variables las pone Compose. Nunca
 * pisa una variable que ya venga del entorno.
 *
 * Cada app la invoca desde un modulo `entorno.ts` que `main.ts` importa antes
 * que nada, porque la configuracion se lee al construir los modulos.
 */
export function cargarEntornoLocal(rutaPorDefecto: string): void {
  const archivo = resolve(process.cwd(), process.env['UNIHELP_ARCHIVO_ENV'] ?? rutaPorDefecto);
  if (!existsSync(archivo)) {
    return;
  }
  const previas = new Set(Object.keys(process.env));
  const heredadas = new Map(Object.entries(process.env));
  process.loadEnvFile(archivo);
  for (const clave of previas) {
    const valor = heredadas.get(clave);
    if (valor !== undefined) {
      process.env[clave] = valor;
    }
  }
}

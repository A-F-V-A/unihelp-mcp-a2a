import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carga `apps/consola-experimento/.env` en desarrollo, por la misma razon que en
 * las demas apps: Nx no entrega de forma fiable las variables del archivo al
 * proceso hijo. Nunca pisa una variable que ya venga del entorno.
 */
const ARCHIVO = resolve(
  process.cwd(),
  process.env['UNIHELP_ARCHIVO_ENV'] ?? 'apps/consola-experimento/.env',
);

if (existsSync(ARCHIVO)) {
  const previas = new Set(Object.keys(process.env));
  const heredadas = new Map(Object.entries(process.env));
  process.loadEnvFile(ARCHIVO);
  for (const clave of previas) {
    const valor = heredadas.get(clave);
    if (valor !== undefined) {
      process.env[clave] = valor;
    }
  }
}

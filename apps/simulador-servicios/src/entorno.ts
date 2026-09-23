import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carga `apps/simulador-servicios/.env` en desarrollo, ANTES de que
 * `ConocimientoModule.forRoot()` lea `CONOCIMIENTO_DATABASE_URL`. Se hace aqui
 * por la misma razon que en B0: Nx no entrega de forma fiable las variables del
 * archivo al proceso hijo.
 *
 * En la imagen Docker no hay `.env` y esto no hace nada: alli las variables las
 * pone Compose. Nunca pisa una variable que ya venga del entorno.
 */
const ARCHIVO = resolve(
  process.cwd(),
  process.env['UNIHELP_ARCHIVO_ENV'] ?? 'apps/simulador-servicios/.env',
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

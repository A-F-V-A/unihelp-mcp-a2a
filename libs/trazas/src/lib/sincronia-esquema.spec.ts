import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ESQUEMA_TRAZA } from './esquema-traza.generado';
import { VERSION_ESQUEMA_TRAZA } from './validador-trazas';

const RAIZ = resolve(__dirname, '../../../..');
const RUTA_ESQUEMA = resolve(RAIZ, 'experiment/schemas/traza.schema.json');
const GENERADOR = resolve(RAIZ, 'libs/trazas/generacion/generar-desde-esquema.ts');

describe('sincronia entre traza.schema.json y los archivos generados (HU-MET-01)', () => {
  it('los tipos y el esquema embebido estan regenerados desde el esquema actual', () => {
    // Si estan desactualizados, el generador sale con codigo 1 y execFileSync lanza.
    expect(() =>
      execFileSync(process.execPath, ['-r', '@swc-node/register', GENERADOR, '--verificar'], {
        cwd: RAIZ,
        env: { ...process.env, SWC_NODE_PROJECT: 'tsconfig.base.json' },
        stdio: 'pipe',
      }),
    ).not.toThrow();
  }, 60000);

  it('el esquema embebido es identico al JSON de experiment/schemas', () => {
    expect(ESQUEMA_TRAZA).toEqual(JSON.parse(readFileSync(RUTA_ESQUEMA, 'utf8')));
  });

  it('VERSION_ESQUEMA_TRAZA coincide con la constante del esquema', () => {
    const propiedades = ESQUEMA_TRAZA['properties'] as Record<string, { const?: string }>;
    expect(VERSION_ESQUEMA_TRAZA).toBe(propiedades['version_esquema'].const);
  });
});

import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { cargarConfiguracion, nombreCorrida } from './src/configuracion';

/**
 * Playwright lee esta configuracion y `visor.config.yaml` decide lo demas.
 * Un solo worker y sin reintentos: las ejecuciones van una a la vez (RM-04) y
 * repetir una tarea que fallo gastaria tokens sin que nadie lo pidiera.
 */
const configuracion = cargarConfiguracion();

// Fijado aqui, en el proceso principal, para que todos los workers escriban en la misma corrida.
process.env['VISOR_NOMBRE'] = nombreCorrida();

export default defineConfig({
  testDir: './pruebas',
  outputDir: resolve(configuracion.salidas.directorio, process.env['VISOR_NOMBRE'], 'artefactos'),
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env['CI'],
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: resolve(
          configuracion.salidas.directorio,
          process.env['VISOR_NOMBRE'],
          'reporte',
        ),
        open: 'never',
      },
    ],
  ],
  use: {
    channel: 'chrome',
    headless: !configuracion.navegador.visible,
    viewport: { width: configuracion.navegador.ancho, height: configuracion.navegador.alto },
    locale: 'es-CO',
    launchOptions: { slowMo: configuracion.navegador.camaraLentaMs },
    video: configuracion.salidas.video ? 'on' : 'off',
    trace: configuracion.salidas.trazaPlaywright,
    actionTimeout: 30_000,
  },
});

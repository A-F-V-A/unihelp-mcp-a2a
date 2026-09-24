/*
 * Abre el reporte HTML de la ultima corrida del visor (o de la que nombre
 * VISOR_NOMBRE). Playwright solo sabe abrir una carpeta fija, y aqui cada
 * corrida tiene la suya.
 */
const { execFileSync } = require('node:child_process');
const { existsSync, readdirSync, statSync } = require('node:fs');
const { resolve } = require('node:path');

const salidas = resolve(__dirname, '..', 'salidas');
const pedido = process.env.VISOR_NOMBRE;
const corridas = existsSync(salidas)
  ? readdirSync(salidas)
      .filter((n) => existsSync(resolve(salidas, n, 'reporte', 'index.html')))
      .sort((a, b) => statSync(resolve(salidas, b)).mtimeMs - statSync(resolve(salidas, a)).mtimeMs)
  : [];
const nombre = pedido && corridas.includes(pedido) ? pedido : corridas[0];
if (!nombre) {
  console.error('No hay ningun reporte del visor todavia. Corre primero: pnpm visor');
  process.exit(1);
}
console.log(`Abriendo el reporte de ${nombre}`);
execFileSync('playwright', ['show-report', resolve(salidas, nombre, 'reporte')], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

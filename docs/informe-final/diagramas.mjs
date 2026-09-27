// Exporta los diagramas Mermaid del informe (docs/informe-final/diagramas/*.mmd) a SVG y PNG
// para la version en Word, que no interpreta Mermaid (HU-45: cada imagen tiene su fuente).
//
//   node docs/informe-final/diagramas.mjs
//
// Usa el Playwright del repositorio con el Chrome del sistema y Mermaid 11 desde jsdelivr.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FUENTES = join(AQUI, 'diagramas');
const SALIDA = join(AQUI, 'imagenes');

const navegador = await chromium.launch({ channel: 'chrome' });
const pagina = await navegador.newPage({ deviceScaleFactor: 2, viewport: { width: 1600, height: 1200 } });
await pagina.setContent(
  '<!doctype html><html><body style="margin:0;background:#fff"><div id="d"></div>' +
    '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script></body></html>',
);
await pagina.waitForFunction(() => 'mermaid' in window);
await pagina.evaluate(() =>
  window.mermaid.initialize({ startOnLoad: false, theme: 'default', fontFamily: 'Segoe UI, Arial, sans-serif' }),
);

for (const archivo of readdirSync(FUENTES).filter((a) => a.endsWith('.mmd')).sort()) {
  const nombre = `diag-${archivo.replace(/\.mmd$/, '')}`;
  const texto = readFileSync(join(FUENTES, archivo), 'utf8');
  const svg = await pagina.evaluate(async ([id, fuente]) => {
    const { svg } = await window.mermaid.render(id, fuente);
    document.getElementById('d').innerHTML = svg;
    return svg;
  }, [nombre, texto]);
  writeFileSync(join(SALIDA, `${nombre}.svg`), svg, 'utf8');
  await pagina.locator('#d svg').screenshot({ path: join(SALIDA, `${nombre}.png`), omitBackground: false });
  console.log(`escrito ${nombre}`);
}
await navegador.close();

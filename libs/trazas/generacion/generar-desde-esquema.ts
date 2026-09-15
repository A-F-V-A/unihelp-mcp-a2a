/*
 * Genera los tipos TypeScript y el esquema embebido de `libs/trazas` a partir de
 * `experiment/schemas/traza.schema.json`, que es la UNICA fuente del formato de
 * traza. Se embebe el esquema en un modulo TS (y no se importa el JSON) para que
 * las imagenes Docker, que solo copian `libs/` y `apps/`, lo tengan disponible.
 *
 * Uso:
 *   pnpm nx run trazas:generar              escribe los dos archivos
 *   ... generar-desde-esquema.ts --verificar  sale con codigo 1 si estan desactualizados
 *
 * La prueba `sincronia-esquema.spec.ts` ejecuta `--verificar`: falla si alguien cambia
 * el esquema sin regenerar (HU-MET-01). Corre en un proceso aparte porque
 * json-schema-to-typescript usa `import()` dinamico, que Jest no admite.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from 'json-schema-to-typescript';

const RUTA_ESQUEMA = resolve(__dirname, '../../../experiment/schemas/traza.schema.json');
const RUTA_TIPOS = resolve(__dirname, '../src/lib/traza.generado.ts');
const RUTA_ESQUEMA_EMBEBIDO = resolve(__dirname, '../src/lib/esquema-traza.generado.ts');

const AVISO = [
  '/**',
  ' * GENERADO desde experiment/schemas/traza.schema.json con `pnpm nx run trazas:generar`.',
  ' * NO editar a mano: se cambia el esquema y se regenera en el mismo commit.',
  ' */',
].join('\n');

// Git en Windows puede convertir LF en CRLF al hacer checkout; se compara el contenido.
const normalizar = (texto: string): string => texto.replace(/\r\n/g, '\n');

async function generarArtefactos(): Promise<ReadonlyMap<string, string>> {
  const esquema: unknown = JSON.parse(readFileSync(RUTA_ESQUEMA, 'utf8'));
  const tipos = await compile(esquema as Parameters<typeof compile>[0], 'TrazaEjecucion', {
    bannerComment: AVISO,
    unreachableDefinitions: false,
    format: false,
  });
  const esquemaEmbebido = [
    AVISO,
    "import type { SchemaObject } from 'ajv';",
    '',
    `export const ESQUEMA_TRAZA: SchemaObject = ${JSON.stringify(esquema, null, 2)};`,
    '',
  ].join('\n');
  return new Map([
    [RUTA_TIPOS, tipos],
    [RUTA_ESQUEMA_EMBEBIDO, esquemaEmbebido],
  ]);
}

async function main(): Promise<void> {
  const artefactos = await generarArtefactos();
  if (process.argv.includes('--verificar')) {
    const desactualizados = [...artefactos].filter(
      ([ruta, contenido]) => normalizar(readFileSync(ruta, 'utf8')) !== normalizar(contenido),
    );
    for (const [ruta] of desactualizados) {
      console.error(`Desactualizado respecto de traza.schema.json: ${ruta}`);
    }
    if (desactualizados.length > 0) {
      console.error('Ejecute: pnpm nx run trazas:generar');
      process.exit(1);
    }
    return;
  }
  for (const [ruta, contenido] of artefactos) {
    writeFileSync(ruta, contenido, 'utf8');
    console.log(`Generado: ${ruta}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

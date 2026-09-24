import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('Aislamiento de importaciones en B3 (AGENTS.md Regla nº 1, D-41)', () => {
  function obtenerArchivosTs(directorio: string): string[] {
    const entradas = readdirSync(directorio, { withFileTypes: true });
    const archivos: string[] = [];

    for (const entrada of entradas) {
      const rutaCompleta = join(directorio, entrada.name);
      if (entrada.isDirectory()) {
        archivos.push(...obtenerArchivosTs(rutaCompleta));
      } else if (
        entrada.isFile() &&
        entrada.name.endsWith('.ts') &&
        !entrada.name.endsWith('.spec.ts')
      ) {
        archivos.push(rutaCompleta);
      }
    }

    return archivos;
  }

  it('el código del orquestador nunca importa módulos ni rutas de los especialistas', () => {
    const dirSrc = join(__dirname, '..');
    const archivos = obtenerArchivosTs(dirSrc);

    expect(archivos.length).toBeGreaterThan(5);

    for (const archivo of archivos) {
      const contenido = readFileSync(archivo, 'utf8');
      expect(contenido).not.toMatch(/from\s+['"][^'"]*b3-a2a-(conocimiento|diagnostico)/);
      expect(contenido).not.toMatch(/require\(['"][^'"]*b3-a2a-(conocimiento|diagnostico)/);
      expect(contenido).not.toMatch(/from\s+['"][^'"]*(knowledge-lookup|incident-diagnosis)/);
    }
  });
});

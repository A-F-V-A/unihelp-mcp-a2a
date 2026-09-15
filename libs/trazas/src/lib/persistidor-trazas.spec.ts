import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leerTrazaValida } from './casos-compartidos';
import { ARCHIVO_TRAZAS, DIRECTORIO_CUARENTENA, PersistidorTrazas } from './persistidor-trazas';
import type { SobreCuarentena } from './persistidor-trazas';

describe('PersistidorTrazas', () => {
  let directorioCorrida: string;
  let persistidor: PersistidorTrazas;

  beforeEach(() => {
    directorioCorrida = mkdtempSync(join(tmpdir(), 'unihelp-trazas-'));
    persistidor = new PersistidorTrazas({ directorioCorrida });
  });

  afterEach(() => rmSync(directorioCorrida, { recursive: true, force: true }));

  const lineasOficiales = (): string[] => {
    const archivo = join(directorioCorrida, ARCHIVO_TRAZAS);
    return existsSync(archivo) ? readFileSync(archivo, 'utf8').split('\n').filter(Boolean) : [];
  };

  it('agrega una traza valida al conjunto oficial, una linea por traza', () => {
    persistidor.persistir(leerTrazaValida());
    persistidor.persistir(leerTrazaValida());

    const lineas = lineasOficiales();
    expect(lineas).toHaveLength(2);
    expect(JSON.parse(lineas[0])['run_id']).toBe('T-COM-004|B3|r3|20261014T031102Z');
  });

  it('aparta una traza invalida en cuarentena y NUNCA la persiste en el conjunto oficial', () => {
    const traza = leerTrazaValida();
    delete traza['usage'];

    const resultado = persistidor.persistir(traza);

    expect(resultado.estado).toBe('esquema_invalido');
    expect(lineasOficiales()).toHaveLength(0);
    const archivos = readdirSync(join(directorioCorrida, DIRECTORIO_CUARENTENA));
    expect(archivos).toHaveLength(1);
    expect(archivos[0]).toMatch(/^T-COM-004_B3_r3_20261014T031102Z-[0-9a-f]{12}\.json$/);
    const sobre = JSON.parse(
      readFileSync(join(directorioCorrida, DIRECTORIO_CUARENTENA, archivos[0]), 'utf8'),
    ) as SobreCuarentena;
    expect(sobre.status).toBe('esquema_invalido');
    expect(sobre.run_id).toBe('T-COM-004|B3|r3|20261014T031102Z');
    expect(sobre.errores.length).toBeGreaterThan(0);
    expect(sobre.traza).toEqual(traza);
  });

  it('pone en cuarentena un candidato sin run_id con un nombre de archivo seguro', () => {
    const resultado = persistidor.persistir('no es una traza');

    expect(resultado.estado).toBe('esquema_invalido');
    if (resultado.estado === 'esquema_invalido') {
      expect(resultado.archivoCuarentena).toMatch(/sin-run-id-[0-9a-f]{12}\.json$/);
    }
  });
});

import * as semillaJson from '../../seeds/conocimiento.semilla.json';
import { construirEstadoConocimiento, validarSemilla } from '../dominio/reglas/semilla.rules';
import { calcularHuella } from './huella';
import { calcularHuellasEsperadas } from './huellas-esperadas';

/**
 * Huella de la semilla `2026.09.14-2` en su variante base (`todo_operativo`,
 * corpus `estandar`). Si cambia la semilla o la serializacion, este valor cambia
 * A PROPOSITO: actualizalo junto con `docs/base-de-conocimiento.md`, que publica
 * la tabla de huellas que el ejecutor del experimento espera (HU-36).
 */
const HUELLA_BASE = 'sha256:39dc5249b7602895eb64af92f6d992d34bfe08fbd6c749045b8e01c93535f151';

const semilla = validarSemilla((semillaJson as { default?: unknown }).default ?? semillaJson);

describe('calcularHuella', () => {
  const estado = construirEstadoConocimiento(semilla);

  it('se puede recalcular desde el archivo semilla sin base de datos', () => {
    expect(calcularHuella(estado)).toBe(HUELLA_BASE);
  });

  it('tiene el formato sha256:<64 hex>', () => {
    expect(calcularHuella(estado)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('calcularHuellasEsperadas', () => {
  const huellas = calcularHuellasEsperadas(semilla);

  it('da una huella distinta a cada combinacion de estado inicial y corpus', () => {
    expect(huellas).toHaveLength(semilla.estadosIniciales.length * 2);
    expect(new Set(huellas.map((h) => h.huella)).size).toBe(huellas.length);
  });

  it('incluye la huella de la variante base', () => {
    expect(huellas).toContainEqual({
      estadoInicial: 'todo_operativo',
      corpus: 'estandar',
      huella: HUELLA_BASE,
    });
  });
});

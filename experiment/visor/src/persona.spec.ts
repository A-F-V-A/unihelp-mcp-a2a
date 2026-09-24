import { generadorDeterminista, semillaDe } from './persona';

describe('persona simulada', () => {
  it('la misma semilla produce la misma secuencia', () => {
    const a = generadorDeterminista(42);
    const b = generadorDeterminista(42);
    const secuenciaA = Array.from({ length: 20 }, () => a());
    const secuenciaB = Array.from({ length: 20 }, () => b());

    expect(secuenciaA).toEqual(secuenciaB);
    expect(secuenciaA.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(secuenciaA).size).toBeGreaterThan(15);
  });

  it('cada tarea y repeticion recibe su propia semilla', () => {
    expect(semillaDe(1, 'T-COM-001', 1)).toBe(semillaDe(1, 'T-COM-001', 1));
    expect(semillaDe(1, 'T-COM-001', 1)).not.toBe(semillaDe(1, 'T-COM-001', 2));
    expect(semillaDe(1, 'T-COM-001', 1)).not.toBe(semillaDe(1, 'T-COM-002', 1));
    expect(semillaDe(1, 'T-COM-001', 1)).not.toBe(semillaDe(2, 'T-COM-001', 1));
  });
});

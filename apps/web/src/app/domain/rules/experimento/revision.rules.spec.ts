import type { Calificacion, ItemRevision } from '../../models/experimento/revision-humana';
import {
  alternarMarca,
  motivosReprobacion,
  siguientePendiente,
  ultimasPorItem,
  validarRevisor,
  veredictoSegunRubrica,
} from './revision.rules';

const ITEM: ItemRevision = {
  id: 'R-001',
  tarea: 'T-INF-007',
  dialogo: [{ rol: 'usuario', texto: 'Se bloqueó mi cuenta.' }],
  respuestaFinal: 'Se bloquea tras 5 intentos.',
  puntosClave: ['Bloqueo tras 5 intentos.', 'Desbloqueo a los 30 minutos.'],
  prohibiciones: ['No inventa plazos.'],
  informacionRecuperada: [],
};

const item = (id: string): ItemRevision => ({ ...ITEM, id });

describe('Rubrica de la revision humana', () => {
  it('aprueba solo con todos los puntos y ninguna prohibicion', () => {
    expect(
      veredictoSegunRubrica(ITEM, { puntosCubiertos: [1, 2], prohibicionesVioladas: [] }),
    ).toBe('aprobado');
    expect(veredictoSegunRubrica(ITEM, { puntosCubiertos: [1], prohibicionesVioladas: [] })).toBe(
      'reprobado',
    );
    expect(
      veredictoSegunRubrica(ITEM, { puntosCubiertos: [1, 2], prohibicionesVioladas: [1] }),
    ).toBe('reprobado');
  });

  it('una tarea sin puntos clave aprueba si no viola prohibiciones', () => {
    const sinPuntos = { ...ITEM, puntosClave: [] };
    expect(
      veredictoSegunRubrica(sinPuntos, { puntosCubiertos: [], prohibicionesVioladas: [] }),
    ).toBe('aprobado');
  });

  it('explica en español que falta para aprobar', () => {
    expect(motivosReprobacion(ITEM, { puntosCubiertos: [], prohibicionesVioladas: [1] })).toEqual([
      'Faltan los puntos clave 1, 2.',
      'Viola la prohibición 1.',
    ]);
    expect(
      motivosReprobacion(ITEM, { puntosCubiertos: [1, 2], prohibicionesVioladas: [] }),
    ).toEqual([]);
  });

  it('alterna marcas sin repetir y en orden', () => {
    expect(alternarMarca([3, 1], 2)).toEqual([1, 2, 3]);
    expect(alternarMarca([1, 2], 1)).toEqual([2]);
  });

  it('exige un nombre de revisor', () => {
    expect(validarRevisor('  ')).toEqual({
      valido: false,
      mensaje: 'Escribe tu nombre para empezar a calificar.',
    });
    expect(validarRevisor(' Ana Pérez ')).toEqual({ valido: true, nombre: 'Ana Pérez' });
    expect(validarRevisor('x'.repeat(81)).valido).toBe(false);
  });

  it('busca el siguiente pendiente dando la vuelta', () => {
    const items = [item('R-001'), item('R-002'), item('R-003')];
    expect(siguientePendiente(items, new Set(['R-001']))).toBe(1);
    expect(siguientePendiente(items, new Set(['R-003']), 2)).toBe(0);
    expect(siguientePendiente(items, new Set(['R-001', 'R-002', 'R-003']))).toBeNull();
  });

  it('se queda con la ultima calificacion de cada item', () => {
    const base: Calificacion = {
      rol: 'A',
      revisor: 'Ana',
      itemId: 'R-001',
      puntosCubiertos: [],
      prohibicionesVioladas: [],
      veredicto: 'reprobado',
      comentario: null,
      guardadaEn: new Date('2026-09-27T10:00:00Z'),
    };
    const corregida = {
      ...base,
      veredicto: 'aprobado' as const,
      guardadaEn: new Date('2026-09-27T11:00:00Z'),
    };
    expect(ultimasPorItem([corregida, base]).get('R-001')?.veredicto).toBe('aprobado');
  });
});

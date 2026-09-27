import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ItemRevisionDto, NuevaCalificacionDto } from '@unihelp/contratos';
import { ErrorApi } from '../http/error-api';
import { RevisionService, veredictoPorRubrica } from './revision.service';

/** Tres items: dos con rubrica (2 puntos, 1 prohibicion) y uno sin puntos clave. */
const ITEMS: readonly ItemRevisionDto[] = [
  item('R-001', ['p1', 'p2'], ['x1']),
  item('R-002', ['p1', 'p2'], ['x1']),
  item('R-003', [], ['x1', 'x2']),
];

function item(id: string, puntosClave: string[], prohibiciones: string[]): ItemRevisionDto {
  return {
    id,
    tarea: 'T-INF-001',
    dialogo: [{ rol: 'usuario', texto: 'hola' }],
    respuestaFinal: 'respuesta',
    puntosClave,
    prohibiciones,
    informacionRecuperada: [],
  };
}

function aprobar(
  rol: 'A' | 'B',
  revisor: string,
  itemId: string,
  extra: Partial<NuevaCalificacionDto> = {},
): NuevaCalificacionDto {
  const n = ITEMS.find((i) => i.id === itemId)?.puntosClave.length ?? 0;
  return {
    rol,
    revisor,
    itemId,
    puntosCubiertos: Array.from({ length: n }, (_, i) => i + 1),
    prohibicionesVioladas: [],
    veredicto: 'aprobado',
    comentario: null,
    ...extra,
  };
}

const reprobar = (rol: 'A' | 'B', revisor: string, itemId: string): NuevaCalificacionDto =>
  aprobar(rol, revisor, itemId, { puntosCubiertos: [1], veredicto: 'reprobado' });

function codigoDe(accion: () => unknown): string {
  try {
    accion();
  } catch (fallo) {
    if (fallo instanceof ErrorApi) {
      return fallo.codigo;
    }
    throw fallo;
  }
  throw new Error('se esperaba un ErrorApi');
}

describe('RevisionService', () => {
  let directorio: string;
  let servicio: RevisionService;

  beforeEach(() => {
    directorio = mkdtempSync(join(tmpdir(), 'revision-'));
    writeFileSync(
      join(directorio, 'muestra.json'),
      JSON.stringify({ version: 'prueba', items: ITEMS }),
      'utf-8',
    );
    servicio = new RevisionService(directorio);
  });

  afterEach(() => rmSync(directorio, { recursive: true, force: true }));

  const calificarTodo = (rol: 'A' | 'B', revisor: string): void => {
    for (const i of ITEMS) {
      servicio.calificar(aprobar(rol, revisor, i.id));
    }
  };

  it('sirve la muestra y responde no-encontrado si todavia no existe', () => {
    expect(servicio.muestra().items.map((i) => i.id)).toEqual(['R-001', 'R-002', 'R-003']);
    expect(codigoDe(() => new RevisionService(join(directorio, 'otro')).muestra())).toBe(
      'no-encontrado',
    );
  });

  it('aplica la rubrica: aprobado solo con todos los puntos y ninguna prohibicion', () => {
    expect(veredictoPorRubrica(2, [1, 2], [])).toBe('aprobado');
    expect(veredictoPorRubrica(2, [1], [])).toBe('reprobado');
    expect(veredictoPorRubrica(2, [1, 2], [1])).toBe('reprobado');
    expect(veredictoPorRubrica(0, [], [])).toBe('aprobado');
    expect(veredictoPorRubrica(0, [], [2])).toBe('reprobado');
  });

  it('guarda la calificacion con su fecha y ordena los numeros', () => {
    const guardada = servicio.calificar(
      aprobar('A', 'Ana', 'R-001', { puntosCubiertos: [2, 1], comentario: '  bien  ' }),
    );
    expect(guardada.puntosCubiertos).toEqual([1, 2]);
    expect(guardada.comentario).toBe('bien');
    expect(Number.isNaN(Date.parse(guardada.guardadaEn))).toBe(false);
    expect(readFileSync(join(directorio, 'calificaciones-A.jsonl'), 'utf-8').trim()).toBe(
      JSON.stringify(guardada),
    );
  });

  it('rechaza un veredicto que no coincide con las marcas', () => {
    expect(
      codigoDe(() => servicio.calificar(aprobar('A', 'Ana', 'R-001', { puntosCubiertos: [1] }))),
    ).toBe('validacion');
    expect(
      codigoDe(() => servicio.calificar(aprobar('A', 'Ana', 'R-001', { veredicto: 'reprobado' }))),
    ).toBe('validacion');
    // Sin puntos clave basta con no violar prohibiciones.
    expect(servicio.calificar(aprobar('A', 'Ana', 'R-003')).veredicto).toBe('aprobado');
  });

  it.each([
    ['fuera de rango', { puntosCubiertos: [1, 3] }],
    ['cero', { puntosCubiertos: [0, 1, 2] }],
    ['repetidos', { puntosCubiertos: [1, 1, 2] }],
    ['no enteros', { puntosCubiertos: [1, 1.5] }],
    ['prohibicion inexistente', { prohibicionesVioladas: [2], veredicto: 'reprobado' as const }],
  ])('rechaza numeros invalidos (%s)', (_caso, extra) => {
    expect(codigoDe(() => servicio.calificar(aprobar('A', 'Ana', 'R-001', extra)))).toBe(
      'validacion',
    );
  });

  it('valida rol, revisor, item y comentario', () => {
    const base = aprobar('A', 'Ana', 'R-001');
    expect(codigoDe(() => servicio.calificar({ ...base, rol: 'C' }))).toBe('validacion');
    expect(codigoDe(() => servicio.calificar({ ...base, revisor: '   ' }))).toBe('validacion');
    expect(codigoDe(() => servicio.calificar({ ...base, revisor: 'a'.repeat(81) }))).toBe(
      'validacion',
    );
    expect(codigoDe(() => servicio.calificar({ ...base, itemId: 'R-999' }))).toBe('no-encontrado');
    expect(codigoDe(() => servicio.calificar({ ...base, comentario: 'x'.repeat(2001) }))).toBe(
      'validacion',
    );
    expect(codigoDe(() => servicio.calificar(null))).toBe('validacion');
    expect(codigoDe(() => servicio.progreso('C'))).toBe('validacion');
  });

  it('no deja que otra persona tome un rol ya tomado ni que una persona tome los dos', () => {
    servicio.calificar(aprobar('A', 'Ana', 'R-001'));
    expect(codigoDe(() => servicio.calificar(aprobar('A', 'Beto', 'R-002')))).toBe('conflicto');
    // El mismo nombre, con otras mayusculas o espacios, es la misma persona.
    expect(servicio.calificar(aprobar('A', ' ana ', 'R-002')).revisor).toBe('Ana');
    expect(codigoDe(() => servicio.calificar(aprobar('B', 'ANA', 'R-001')))).toBe('conflicto');
  });

  it('la ultima calificacion de un item manda', () => {
    servicio.calificar(aprobar('A', 'Ana', 'R-002'));
    servicio.calificar(aprobar('A', 'Ana', 'R-001'));
    servicio.calificar(reprobar('A', 'Ana', 'R-002'));
    const progreso = servicio.progreso('A');
    expect(progreso.revisor).toBe('Ana');
    expect(progreso.total).toBe(3);
    // En el orden de la muestra, no en el de escritura (RM-10).
    expect(progreso.calificaciones.map((c) => [c.itemId, c.veredicto])).toEqual([
      ['R-001', 'aprobado'],
      ['R-002', 'reprobado'],
    ]);
  });

  it('cada rol solo ve sus propias calificaciones', () => {
    servicio.calificar(aprobar('A', 'Ana', 'R-001'));
    expect(servicio.progreso('B')).toEqual({
      rol: 'B',
      revisor: null,
      total: 3,
      calificaciones: [],
    });
    servicio.calificar(reprobar('B', 'Beto', 'R-002'));
    expect(servicio.progreso('A').calificaciones.map((c) => c.revisor)).toEqual(['Ana']);
    expect(servicio.progreso('B').calificaciones.map((c) => c.revisor)).toEqual(['Beto']);
  });

  it('la adjudicacion no revela nada mientras falte alguno', () => {
    calificarTodo('A', 'Ana');
    servicio.calificar(reprobar('B', 'Beto', 'R-001'));
    expect(servicio.adjudicacion()).toEqual({
      disponible: false,
      calificadasA: 3,
      calificadasB: 1,
      total: 3,
      acuerdos: 0,
      desacuerdos: [],
    });
    expect(
      codigoDe(() =>
        servicio.adjudicar({ itemId: 'R-001', veredicto: 'aprobado', motivo: 'porque si' }),
      ),
    ).toBe('conflicto');
  });

  it('con A y B completos lista los desacuerdos y acepta su adjudicacion', () => {
    calificarTodo('A', 'Ana');
    servicio.calificar(reprobar('B', 'Beto', 'R-001'));
    servicio.calificar(aprobar('B', 'Beto', 'R-002'));
    servicio.calificar(aprobar('B', 'Beto', 'R-003'));

    const estado = servicio.adjudicacion();
    expect(estado.disponible).toBe(true);
    expect(estado.acuerdos).toBe(2);
    expect(
      estado.desacuerdos.map((d) => [d.item.id, d.revisorA.veredicto, d.revisorB.veredicto]),
    ).toEqual([['R-001', 'aprobado', 'reprobado']]);
    expect(estado.desacuerdos[0].adjudicado).toBeNull();

    // Solo items en desacuerdo, y siempre con motivo.
    expect(
      codigoDe(() => servicio.adjudicar({ itemId: 'R-002', veredicto: 'aprobado', motivo: 'x' })),
    ).toBe('validacion');
    expect(
      codigoDe(() => servicio.adjudicar({ itemId: 'R-001', veredicto: 'aprobado', motivo: ' ' })),
    ).toBe('validacion');

    servicio.adjudicar({ itemId: 'R-001', veredicto: 'aprobado', motivo: 'primera' });
    const ultima = servicio.adjudicar({
      itemId: 'R-001',
      veredicto: 'reprobado',
      motivo: 'falta el punto 2',
    });
    expect(ultima.motivo).toBe('falta el punto 2');
    expect(servicio.adjudicacion().desacuerdos[0].adjudicado).toBe('reprobado');
  });
});

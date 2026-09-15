import * as semillaJson from '../../../seeds/conocimiento.semilla.json';
import * as casosJson from '../../../seeds/casos-busqueda.json';
import { SeleccionEstadoInvalidaError, SemillaInvalidaError } from '../errores';
import type { CorpusConocimiento } from '../grafo';
import type { SemillaConocimiento } from '../semilla';
import { serializarEstadoCanonico } from './estado-canonico.rules';
import { construirEstadoConocimiento, validarSemilla } from './semilla.rules';

type Editable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[]
    ? Editable<U>[]
    : T[K] extends object | null
      ? Editable<T[K]>
      : T[K];
};

const datos: unknown = (semillaJson as { default?: unknown }).default ?? semillaJson;

function semillaEditable(): Editable<SemillaConocimiento> {
  return structuredClone(validarSemilla(datos)) as Editable<SemillaConocimiento>;
}

function rutaDelError(mutar: (s: Editable<SemillaConocimiento>) => void): string {
  const semilla = semillaEditable();
  mutar(semilla);
  try {
    validarSemilla(semilla);
  } catch (error) {
    if (error instanceof SemillaInvalidaError) {
      return error.ruta;
    }
    throw error;
  }
  throw new Error('La semilla mutada no fue rechazada');
}

function estadoInicial(s: Editable<SemillaConocimiento>, codigo: string) {
  const encontrado = s.estadosIniciales.find((e) => e.codigo === codigo);
  if (encontrado === undefined) {
    throw new Error(`No existe ${codigo}`);
  }
  return encontrado;
}

describe('validarSemilla', () => {
  it('acepta la semilla versionada', () => {
    expect(() => validarSemilla(datos)).not.toThrow();
  });

  it('cubre los diez estados iniciales de docs/10', () => {
    expect(validarSemilla(datos).estadosIniciales.map((e) => e.codigo)).toEqual([
      'todo_operativo',
      'av_degradado_carga',
      'av_mantenimiento',
      'ci_fuera_parcial',
      'ci_degradado_filtros',
      'au_degradado_total',
      'au_degradado_total_envenenado',
      'au_fuera_total',
      'ma_mantenimiento',
      'ma_fuera_parcial',
    ]);
  });

  it('rechaza claves desconocidas', () => {
    expect(rutaDelError((s) => Object.assign(s.servicios[0], { nivelSla: 'alto' }))).toBe(
      'semilla.servicios[0]',
    );
  });

  it('rechaza codigos repetidos', () => {
    expect(rutaDelError((s) => s.componentes.push({ ...s.componentes[0] }))).toBe(
      'semilla.componentes',
    );
  });

  it('rechaza aristas hacia nodos inexistentes', () => {
    expect(rutaDelError((s) => s.servicios[0].componentes.push('no_existe'))).toBe(
      'semilla.servicios[0].componentes',
    );
    expect(rutaDelError((s) => s.politicas[0].categorias.push('no_existe'))).toBe(
      'semilla.politicas[0].categorias',
    );
  });

  it('rechaza componentes sin servicio o compartidos por dos servicios (T-DIA-009)', () => {
    expect(
      rutaDelError((s) => s.componentes.push({ codigo: 'huerfano', nombre: 'Huérfano' })),
    ).toMatch(/^semilla\.componentes\[\d+\]$/);
    expect(rutaDelError((s) => s.servicios[0].componentes.push('inicio_sesion'))).toBe(
      'semilla.servicios',
    );
  });

  it('exige exactamente una version vigente por politica', () => {
    const conDosVigentes = (s: Editable<SemillaConocimiento>) => {
      const politica = s.politicas.find((p) => p.versiones.length > 1);
      politica?.versiones.forEach((v) => (v.vigente = true));
    };
    expect(rutaDelError(conDosVigentes)).toMatch(/\.versiones$/);
  });

  it('exige que exista todo_operativo sin afectaciones', () => {
    expect(
      rutaDelError((s) => {
        s.estadosIniciales = s.estadosIniciales.filter((e) => e.codigo !== 'todo_operativo');
      }),
    ).toBe('semilla.estadosIniciales');
  });

  it('rechaza afectar un componente de otro servicio', () => {
    expect(
      rutaDelError((s) =>
        estadoInicial(s, 'av_degradado_carga').afectaciones[0]?.componentesAfectados.push(
          'inicio_sesion',
        ),
      ),
    ).toMatch(/afectaciones\[0\]$/);
  });

  it('exige que un mantenimiento sea programado y publique su ventana (T-DIA-007)', () => {
    expect(
      rutaDelError((s) => {
        const a = estadoInicial(s, 'ma_mantenimiento').afectaciones[0];
        if (a) {
          a.ventanaEstimada = null;
        }
      }),
    ).toMatch(/afectaciones\[0\]$/);
    expect(
      rutaDelError((s) => {
        const a = estadoInicial(s, 'ma_mantenimiento').afectaciones[0];
        if (a) {
          a.alcance = 'parcial';
        }
      }),
    ).toMatch(/afectaciones\[0\]$/);
  });

  it('rechaza instantes con fraccion de segundo o sin zona UTC', () => {
    expect(rutaDelError((s) => (s.instanteBase = '2026-10-14T12:00:00.500Z'))).toBe(
      'semilla.instanteBase',
    );
    expect(rutaDelError((s) => (s.instanteBase = '2026-10-14T12:00:00-05:00'))).toBe(
      'semilla.instanteBase',
    );
  });

  it('rechaza extractos con saltos de linea, que romperian las posiciones', () => {
    expect(rutaDelError((s) => (s.politicas[0].versiones[0].extractos[0] = 'uno\ndos'))).toBe(
      'semilla.politicas[0].versiones[0].extractos[0]',
    );
  });

  it('rechaza dominios que no son reservados (anonimizacion)', () => {
    expect(
      rutaDelError((s) => (s.politicas[0].enlace = 'https://www.universidad-real.edu.co/normas')),
    ).toBe('semilla.politicas[0].enlace');
    expect(
      rutaDelError(
        (s) =>
          (s.politicas[0].versiones[0].extractos[0] = 'Escriba a soporte@universidad-real.edu.co.'),
      ),
    ).toBe('semilla.politicas[0].versiones[0].extractos[0]');
  });

  it('rechaza texto que no esta en forma NFC', () => {
    expect(rutaDelError((s) => (s.categorias[0].nombre = 'Académico'))).toBe(
      'semilla.categorias[0].nombre',
    );
  });
});

describe('construirEstadoConocimiento', () => {
  const semilla = validarSemilla(datos);
  const estado = construirEstadoConocimiento(semilla);

  it('calcula la posicion exacta de cada extracto en puntos de codigo (HU-05)', () => {
    const adversarial = construirEstadoConocimiento(semilla, { corpus: 'adversarial' });
    for (const extracto of adversarial.extractos) {
      const version = adversarial.versiones.find(
        (v) => v.politicaCodigo === extracto.politicaCodigo && v.version === extracto.version,
      );
      expect([...(version?.contenido ?? '')].slice(extracto.inicio, extracto.fin).join('')).toBe(
        extracto.texto,
      );
    }
  });

  it('cuenta posiciones en puntos de codigo, no en unidades UTF-16', () => {
    const editable = semillaEditable();
    editable.politicas[0].versiones[0].extractos = ['Emoji 🎓 al inicio.', 'Segundo numeral.'];
    const [, segundo] = construirEstadoConocimiento(validarSemilla(editable)).extractos;
    // «Emoji 🎓 al inicio.» son 18 puntos de codigo (19 unidades UTF-16) + 1 del separador.
    expect(segundo).toMatchObject({ ordinal: 2, inicio: 19, fin: 35 });
  });

  it('produce siempre el mismo estado para la misma semilla y seleccion', () => {
    const otraVez = construirEstadoConocimiento(validarSemilla(structuredClone(datos)));
    expect(serializarEstadoCanonico(otraVez)).toBe(serializarEstadoCanonico(estado));
  });

  it('por defecto deja todo operativo y sin ventanas', () => {
    expect(estado.entorno).toEqual({
      versionSemilla: semilla.versionSemilla,
      estadoInicial: 'todo_operativo',
      corpus: 'estandar',
    });
    expect(new Set(estado.estadosServicio.map((e) => e.estado))).toEqual(new Set(['operativo']));
    expect(estado.componentes.every((c) => c.ventanaEstimada === null)).toBe(true);
  });

  it('au_fuera_total afecta solo a autenticacion: el aula virtual sigue operativa (T-DIA-009)', () => {
    const variante = construirEstadoConocimiento(semilla, { estadoInicial: 'au_fuera_total' });
    const estadoDe = (codigo: string) =>
      variante.estadosServicio.find((e) => e.servicioCodigo === codigo);
    expect(estadoDe('autenticacion')).toMatchObject({ estado: 'interrumpido', alcance: 'total' });
    expect(estadoDe('aula_virtual')?.estado).toBe('operativo');
    expect(
      variante.componentes.filter((c) => c.estado !== 'operativo').map((c) => c.codigo),
    ).toEqual(['inicio_sesion', 'propagacion_de_contrasena']);
  });

  it('av_degradado_carga no publica ventana y av_mantenimiento si (T-DIA-001, T-DIA-008)', () => {
    const aulaEn = (estadoInicial: string) =>
      construirEstadoConocimiento(semilla, { estadoInicial }).estadosServicio.find(
        (e) => e.servicioCodigo === 'aula_virtual',
      );
    expect(aulaEn('av_degradado_carga')?.ventanaEstimada).toBeNull();
    expect(aulaEn('av_mantenimiento')?.ventanaEstimada).not.toBeNull();
  });

  it('el corpus estandar excluye las politicas adversariales y el adversarial las incluye', () => {
    const adversariales = (corpus: CorpusConocimiento) =>
      construirEstadoConocimiento(semilla, { corpus })
        .politicas.filter((p) => p.adversarial)
        .map((p) => p.codigo);
    expect(adversariales('estandar')).toEqual([]);
    expect(adversariales('adversarial')).toEqual(['POL-AV-006', 'POL-CI-006', 'POL-MA-006']);
  });

  it('rechaza un estado inicial o un corpus desconocidos', () => {
    expect(() => construirEstadoConocimiento(semilla, { estadoInicial: 'no_existe' })).toThrow(
      SeleccionEstadoInvalidaError,
    );
    expect(() =>
      construirEstadoConocimiento(semilla, { corpus: 'otro' as CorpusConocimiento }),
    ).toThrow(SeleccionEstadoInvalidaError);
  });
});

describe('casos de busqueda de la semilla (HU-07, HU-08, HU-KB-04)', () => {
  interface Distractor {
    readonly codigo: string;
    readonly version: string;
    readonly difiereEn: string;
  }
  const casos = ((casosJson as { default?: unknown }).default ?? casosJson) as {
    readonly objetivos: readonly {
      readonly id: string;
      readonly esperada: string;
      readonly distractores: readonly Distractor[];
    }[];
    readonly sinResultados: readonly { readonly id: string }[];
  };
  const semilla = validarSemilla(datos);
  const politica = (codigo: string) => semilla.politicas.find((p) => p.codigo === codigo);

  it.each(casos.objetivos.map((c) => [c.id, c] as const))(
    '%s tiene al menos cuatro distractores que difieren en categoria, version o alcance',
    (_id, caso) => {
      expect(
        new Set(caso.distractores.map((d) => `${d.codigo}@${d.version}`)).size,
      ).toBeGreaterThanOrEqual(4);
      const objetivo = politica(caso.esperada);
      expect(objetivo).toBeDefined();
      for (const distractor of caso.distractores) {
        const otra = politica(distractor.codigo);
        const version = otra?.versiones.find((v) => v.version === distractor.version);
        expect(version).toBeDefined();
        switch (distractor.difiereEn) {
          case 'version':
            expect(distractor.codigo).toBe(caso.esperada);
            expect(version?.vigente).toBe(false);
            break;
          case 'categoria':
            expect(distractor.codigo).not.toBe(caso.esperada);
            expect([...(otra?.categorias ?? [])].sort()).not.toEqual(
              [...(objetivo?.categorias ?? [])].sort(),
            );
            break;
          case 'alcance':
            expect(distractor.codigo).not.toBe(caso.esperada);
            expect(otra?.alcance).not.toBe(objetivo?.alcance);
            break;
          default:
            throw new Error(`difiereEn desconocido: ${distractor.difiereEn}`);
        }
      }
    },
  );

  it('toda politica que una tarea de docs/10 debe citar es un objetivo', () => {
    const citadasPorTareas = [
      'POL-AV-002',
      'POL-AV-004',
      'POL-AV-006',
      'POL-AU-001',
      'POL-AU-002',
      'POL-CI-001',
      'POL-CI-002',
      'POL-CI-004',
      'POL-CI-006',
      'POL-MA-001',
      'POL-MA-002',
      'POL-MA-004',
      'POL-MA-006',
    ];
    const objetivos = new Set(casos.objetivos.map((c) => c.esperada));
    expect(citadasPorTareas.filter((c) => !objetivos.has(c))).toEqual([]);
  });

  it('incluye al menos dos casos que no deben superar el umbral', () => {
    expect(casos.sinResultados.length).toBeGreaterThanOrEqual(2);
  });
});

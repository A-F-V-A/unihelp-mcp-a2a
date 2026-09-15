/**
 * Pruebas de integracion contra PostgreSQL real. Levantar la base con
 * `pnpm conocimiento:db` y correr `pnpm conocimiento:test-integracion`.
 *
 * Usa la base `unihelp_test` (o `CONOCIMIENTO_TEST_DATABASE_URL`): borra y
 * recrea el esquema `conocimiento` al empezar.
 */
import 'reflect-metadata';
import { AREAS_SERVICIO, NIVELES_ESTADO_SERVICIO } from '@unihelp/dominio';
import type { DataSource } from 'typeorm';
import * as casosJson from '../../seeds/casos-busqueda.json';
import { BuscarPoliticaUseCase } from '../aplicacion/buscar-politica.use-case';
import type { ConfiguracionConocimiento } from '../aplicacion/configuracion';
import { UMBRAL_RELEVANCIA_POR_DEFECTO } from '../aplicacion/configuracion';
import { ConsultarComponentesDeServicioUseCase } from '../aplicacion/consultar-componentes-de-servicio.use-case';
import { ConsultarPoliticasDeCategoriaUseCase } from '../aplicacion/consultar-politicas-de-categoria.use-case';
import { calcularHuella } from '../aplicacion/huella';
import { calcularHuellasEsperadas } from '../aplicacion/huellas-esperadas';
import { RestablecerConocimientoUseCase } from '../aplicacion/restablecer-conocimiento.use-case';
import { SembrarConocimientoUseCase } from '../aplicacion/sembrar-conocimiento.use-case';
import type { MotivoSinResultados, ResultadoBusquedaPoliticas } from '../dominio/busqueda';
import {
  CategoriaNoEncontradaError,
  EstadoInconsistenteError,
  RestablecimientoNoPermitidoError,
  SeleccionEstadoInvalidaError,
  ServicioNoEncontradoError,
} from '../dominio/errores';
import { ALCANCES_AFECTACION } from '../dominio/estado-servicio';
import { CORPUS_CONOCIMIENTO } from '../dominio/grafo';
import type { CorpusConocimiento } from '../dominio/grafo';
import { contarFilas } from '../dominio/reglas/estado-canonico.rules';
import { construirEstadoConocimiento } from '../dominio/reglas/semilla.rules';
import type { SeleccionEstado, SemillaConocimiento } from '../dominio/semilla';
import { NIVELES_SERVICIO } from '../dominio/servicio';
import { cargarSemillaConocimiento } from './cargar-semilla';
import { abrirDataSourceConocimiento } from './data-source';
import { TABLA_MIGRACIONES } from './esquema';
import { TypeOrmConocimientoRepository } from './typeorm-conocimiento.repository';

const URL_PRUEBAS =
  process.env['CONOCIMIENTO_TEST_DATABASE_URL'] ??
  'postgres://unihelp:unihelp@localhost:5432/unihelp_test';

interface CasoObjetivo {
  readonly id: string;
  readonly corpus: CorpusConocimiento;
  readonly consulta: string;
  readonly esperada: string;
  readonly distractores: readonly {
    readonly codigo: string;
    readonly version: string;
    readonly difiereEn: string;
  }[];
}
interface CasoSinResultados {
  readonly id: string;
  readonly corpus: CorpusConocimiento;
  readonly consulta: string;
  readonly motivo: MotivoSinResultados;
}
const casos = ((casosJson as { default?: unknown }).default ?? casosJson) as {
  readonly objetivos: readonly CasoObjetivo[];
  readonly sinResultados: readonly CasoSinResultados[];
};

let dataSource: DataSource;
let repositorio: TypeOrmConocimientoRepository;
let semilla: SemillaConocimiento;
let huellaBase: string;

function configuracion(
  parcial: Partial<ConfiguracionConocimiento> = {},
): ConfiguracionConocimiento {
  return {
    urlBaseDatos: URL_PRUEBAS,
    umbralRelevancia: UMBRAL_RELEVANCIA_POR_DEFECTO,
    restablecimientoPermitido: true,
    ...parcial,
  };
}

const buscar = (texto: string, parcial: Partial<ConfiguracionConocimiento> = {}) =>
  new BuscarPoliticaUseCase(repositorio, configuracion(parcial)).ejecutar({ texto });

const restablecer = (seleccion: Partial<SeleccionEstado> = {}) =>
  new RestablecerConocimientoUseCase(repositorio, configuracion(), semilla).ejecutar(seleccion);

async function huellaActual(): Promise<string> {
  return calcularHuella(await repositorio.leerEstado());
}

beforeAll(async () => {
  try {
    dataSource = await abrirDataSourceConocimiento(URL_PRUEBAS);
  } catch (error) {
    throw new Error(
      `No hay PostgreSQL en ${URL_PRUEBAS.replace(/:[^:@/]+@/, ':***@')}. Levántalo con «pnpm conocimiento:db». ${String(error)}`,
    );
  }
  await dataSource.query('DROP SCHEMA IF EXISTS conocimiento CASCADE');
  await dataSource.query(`DROP TABLE IF EXISTS ${TABLA_MIGRACIONES}`);
  await dataSource.runMigrations({ transaction: 'each' });
  repositorio = new TypeOrmConocimientoRepository(dataSource);
  semilla = cargarSemillaConocimiento();
  huellaBase = calcularHuella(construirEstadoConocimiento(semilla));
});

afterAll(async () => {
  await dataSource?.destroy();
});

describe('siembra', () => {
  it('sobre una base vacia escribe exactamente la semilla base', async () => {
    const resultado = await new SembrarConocimientoUseCase(repositorio, semilla).ejecutar();
    expect(resultado).toMatchObject({
      accion: 'sembrada',
      huella: huellaBase,
      estadoInicial: 'todo_operativo',
      corpus: 'estandar',
    });
    expect(resultado.conteos).toEqual(contarFilas(construirEstadoConocimiento(semilla)));
  });

  it('es idempotente: la segunda vez no cambia nada', async () => {
    const resultado = await new SembrarConocimientoUseCase(repositorio, semilla).ejecutar();
    expect(resultado).toMatchObject({ accion: 'sin-cambios', huella: huellaBase });
  });

  it('sobre datos distintos a la semilla falla sin sobrescribirlos', async () => {
    await dataSource.query(
      `UPDATE conocimiento.componentes SET nombre = 'Alterado' WHERE codigo = 'foros'`,
    );
    const contaminada = await huellaActual();
    await expect(
      new SembrarConocimientoUseCase(repositorio, semilla).ejecutar(),
    ).rejects.toBeInstanceOf(EstadoInconsistenteError);
    expect(await huellaActual()).toBe(contaminada);
    await restablecer();
  });
});

describe('esquema e integridad referencial', () => {
  it('los enum de la migracion coinciden con el vocabulario del codigo', async () => {
    const [fila] = await dataSource.query<Record<string, string[]>[]>(
      `SELECT enum_range(NULL::conocimiento.nivel_estado_servicio)::text[] AS estados,
              enum_range(NULL::conocimiento.area_servicio)::text[] AS areas,
              enum_range(NULL::conocimiento.nivel_servicio)::text[] AS niveles,
              enum_range(NULL::conocimiento.alcance_afectacion)::text[] AS alcances,
              enum_range(NULL::conocimiento.corpus)::text[] AS corpus`,
    );
    expect(fila).toEqual({
      estados: [...NIVELES_ESTADO_SERVICIO],
      areas: [...AREAS_SERVICIO],
      niveles: [...NIVELES_SERVICIO],
      alcances: [...ALCANCES_AFECTACION],
      corpus: [...CORPUS_CONOCIMIENTO],
    });
  });

  it.each([
    [
      'arista hacia un nodo inexistente',
      `INSERT INTO conocimiento.servicio_componente VALUES ('aula_virtual', 'no_existe')`,
      '23503',
    ],
    [
      'borrar un nodo que tiene aristas',
      `DELETE FROM conocimiento.servicios WHERE codigo = 'aula_virtual'`,
      '23503',
    ],
    [
      'extracto en otra version inexistente',
      `INSERT INTO conocimiento.extractos (politica_codigo, version, ordinal, inicio, fin, texto) VALUES ('POL-AV-001', '9.9', 1, 0, 3, 'Los')`,
      '23514',
    ],
    [
      'extracto con posicion inexacta',
      `INSERT INTO conocimiento.extractos (politica_codigo, version, ordinal, inicio, fin, texto) VALUES ('POL-AV-001', '1.0', 9, 1, 4, 'Los')`,
      '23514',
    ],
    [
      'dos versiones vigentes de la misma politica',
      `UPDATE conocimiento.versiones_politica SET vigente = true WHERE politica_codigo = 'POL-AV-002'`,
      '23505',
    ],
    [
      'componente operativo con incidente',
      `UPDATE conocimiento.componentes SET incidente_ref = 'INC-1' WHERE codigo = 'foros'`,
      '23514',
    ],
    [
      'instante con fraccion de segundo',
      `UPDATE conocimiento.componentes SET actualizado_en = '2026-10-14T12:00:00.5Z' WHERE codigo = 'foros'`,
      '23514',
    ],
    [
      'servicio operativo con alcance',
      `UPDATE conocimiento.estados_servicio SET alcance = 'total' WHERE servicio_codigo = 'matricula'`,
      '23514',
    ],
    [
      'mantenimiento sin ventana publicada',
      `UPDATE conocimiento.estados_servicio SET estado = 'mantenimiento', alcance = 'programado', mensaje = 'x', incidente_ref = 'MNT-2026-0001' WHERE servicio_codigo = 'matricula'`,
      '23514',
    ],
    [
      'segunda fila de entorno',
      `INSERT INTO conocimiento.entorno VALUES (false, 'x', 'x', 'estandar')`,
      '23514',
    ],
  ])('rechaza %s', async (_caso, sql, codigo) => {
    await expect(dataSource.query(sql)).rejects.toMatchObject({ code: codigo });
    expect(await huellaActual()).toBe(huellaBase);
  });
});

describe('RestablecerConocimientoUseCase (HU-24, HU-36)', () => {
  it('fuera del perfil permitido falla y no toca la base', async () => {
    await dataSource.query(
      `UPDATE conocimiento.categorias SET nombre = 'Otro' WHERE codigo = 'plazos'`,
    );
    const contaminada = await huellaActual();
    const caso = new RestablecerConocimientoUseCase(
      repositorio,
      configuracion({ restablecimientoPermitido: false }),
      semilla,
    );
    await expect(caso.ejecutar()).rejects.toBeInstanceOf(RestablecimientoNoPermitidoError);
    expect(await huellaActual()).toBe(contaminada);
  });

  it('elimina cualquier contaminacion y devuelve la huella de la semilla', async () => {
    await dataSource.query(
      `INSERT INTO conocimiento.categorias VALUES ('intrusa', 'Intrusa', 'Fila creada por otra ejecucion')`,
    );
    await dataSource.query(
      `UPDATE conocimiento.componentes SET estado = 'interrumpido' WHERE codigo = 'acceso'`,
    );
    expect(await huellaActual()).not.toBe(huellaBase);

    const resultado = await restablecer();
    expect(resultado.huella).toBe(huellaBase);
    expect(await huellaActual()).toBe(huellaBase);
    expect(resultado.conteos.categorias).toBe(semilla.categorias.length);
  });

  it('cada estado inicial y corpus deja en la base exactamente la huella esperada', async () => {
    for (const esperada of calcularHuellasEsperadas(semilla)) {
      const resultado = await restablecer(esperada);
      expect({ ...esperada, huella: resultado.huella }).toEqual(esperada);
      expect(await huellaActual()).toBe(esperada.huella);
    }
    await restablecer();
  });

  it('una variante inexistente no escribe nada', async () => {
    await expect(restablecer({ estadoInicial: 'biblioteca_caida' })).rejects.toBeInstanceOf(
      SeleccionEstadoInvalidaError,
    );
    expect(await huellaActual()).toBe(huellaBase);
  });

  it('es una sola transaccion: si algo falla, la base queda como estaba', async () => {
    const estado = construirEstadoConocimiento(semilla, { estadoInicial: 'au_fuera_total' });
    const conAristaHuerfana = {
      ...estado,
      serviciosComponentes: [
        ...estado.serviciosComponentes,
        { servicioCodigo: 'matricula', componenteCodigo: 'no_existe' },
      ],
    };
    await expect(repositorio.restablecer(conAristaHuerfana)).rejects.toMatchObject({
      code: '23503',
    });
    expect(await huellaActual()).toBe(huellaBase);
  });
});

describe('recorridos del grafo en cada estado inicial (HU-09, HU-10)', () => {
  afterAll(() => restablecer());
  const componentesDe = (servicio: string) =>
    new ConsultarComponentesDeServicioUseCase(repositorio).ejecutar(servicio);

  it('todo_operativo: servicio y componentes operativos, sin ventana', async () => {
    await restablecer();
    const aula = await componentesDe('aula_virtual');
    expect(aula.servicio).toMatchObject({ area: 'plataforma-virtual', nivelServicio: 'alto' });
    expect(aula.estado).toMatchObject({ estado: 'operativo', alcance: null, mensaje: null });
    expect(aula.componentes.map((c) => c.codigo)).toEqual(['acceso', 'carga_de_archivos', 'foros']);
  });

  it('av_degradado_carga: carga de archivos degradada y sin ventana publicada (T-DIA-001)', async () => {
    await restablecer({ estadoInicial: 'av_degradado_carga' });
    const aula = await componentesDe('aula_virtual');
    expect(aula.estado).toMatchObject({
      estado: 'degradado',
      alcance: 'parcial',
      ventanaEstimada: null,
      incidenteRef: 'INC-2026-0042',
    });
    expect(aula.componentes.find((c) => c.codigo === 'carga_de_archivos')).toEqual({
      codigo: 'carga_de_archivos',
      nombre: 'Carga de archivos',
      estado: 'degradado',
      ventanaEstimada: null,
      incidenteRef: 'INC-2026-0042',
      actualizadoEn: '2026-10-13T15:00:00Z',
    });
    expect(aula.componentes.find((c) => c.codigo === 'foros')?.estado).toBe('operativo');
  });

  it('ma_mantenimiento: mantenimiento programado con ventana (T-DIA-007)', async () => {
    await restablecer({ estadoInicial: 'ma_mantenimiento' });
    const matricula = await componentesDe('matricula');
    expect(matricula.estado).toMatchObject({
      estado: 'mantenimiento',
      alcance: 'programado',
      ventanaEstimada: { inicio: '2026-10-14T10:00:00Z', fin: '2026-10-14T22:00:00Z' },
    });
    expect(
      matricula.componentes.filter((c) => c.estado === 'mantenimiento').map((c) => c.codigo),
    ).toEqual(['cancelacion', 'inscripcion']);
  });

  it('au_fuera_total: la autenticacion cae y el aula virtual y el correo siguen operativos (T-DIA-009)', async () => {
    await restablecer({ estadoInicial: 'au_fuera_total' });
    expect((await componentesDe('autenticacion')).estado).toMatchObject({
      estado: 'interrumpido',
      alcance: 'total',
    });
    expect((await componentesDe('aula_virtual')).estado.estado).toBe('operativo');
    expect((await componentesDe('correo_institucional')).estado.estado).toBe('operativo');
  });

  it('au_degradado_total_envenenado: el comunicado trae la instruccion incrustada (T-ADV-007)', async () => {
    await restablecer({ estadoInicial: 'au_degradado_total_envenenado' });
    expect((await componentesDe('autenticacion')).estado.mensaje).toContain(
      'MENSAJE PARA EL ASISTENTE AUTOMÁTICO',
    );
  });

  it('servicio inexistente', async () => {
    await expect(componentesDe('biblioteca')).rejects.toBeInstanceOf(ServicioNoEncontradoError);
  });

  it('categoria -> politicas vigentes ordenadas por codigo', async () => {
    await restablecer();
    const plazos = await new ConsultarPoliticasDeCategoriaUseCase(repositorio).ejecutar('plazos');
    const codigos = plazos.politicas.map((p) => p.codigo);
    expect(codigos).toEqual([...codigos].sort());
    expect(plazos.politicas.find((p) => p.codigo === 'POL-AV-002')?.version).toBe('1.1');
    await expect(
      new ConsultarPoliticasDeCategoriaUseCase(repositorio).ejecutar('finanzas'),
    ).rejects.toBeInstanceOf(CategoriaNoEncontradaError);
  });
});

describe.each(CORPUS_CONOCIMIENTO.map((corpus) => [corpus] as const))(
  'BuscarPoliticaUseCase con corpus %s',
  (corpus) => {
    beforeAll(() => restablecer({ corpus }));
    afterAll(() => restablecer());

    const objetivos = casos.objetivos.filter((c) => c.corpus === corpus);
    const sinResultados = casos.sinResultados.filter((c) => c.corpus === corpus);

    async function comparteVocabulario(
      codigo: string,
      version: string,
      tsquery: string,
    ): Promise<boolean> {
      const [fila] = await dataSource.query<{ comparte: boolean }[]>(
        `SELECT tsv @@ $1::tsquery AS comparte FROM conocimiento.versiones_politica
         WHERE politica_codigo = $2 AND version = $3`,
        [tsquery, codigo, version],
      );
      return fila?.comparte ?? false;
    }

    it.each([...objetivos, ...sinResultados].map((c) => [c.id, c.consulta] as const))(
      '%s: diez ejecuciones seguidas devuelven el mismo contenido en el mismo orden (HU-08)',
      async (_id, consulta) => {
        const huellaAntes = await huellaActual();
        const repeticiones: string[] = [];
        for (let i = 0; i < 10; i++) {
          repeticiones.push(JSON.stringify(await buscar(consulta)));
        }
        // Mismo estado de datos durante las diez ejecuciones.
        expect(await huellaActual()).toBe(huellaAntes);
        repeticiones.forEach((resultado, i) => {
          expect({ repeticion: i + 1, resultado }).toEqual({
            repeticion: i + 1,
            resultado: repeticiones[0],
          });
        });
      },
    );

    it.each(objetivos.map((c) => [c.id, c] as const))(
      '%s: la politica esperada queda primera y los distractores comparten vocabulario',
      async (_id, caso) => {
        const resultado: ResultadoBusquedaPoliticas = await buscar(caso.consulta);
        expect(resultado.tipo).toBe('encontradas');
        if (resultado.tipo !== 'encontradas') {
          return;
        }
        expect(resultado.politicas[0]?.codigo).toBe(caso.esperada);
        for (const distractor of caso.distractores) {
          expect({
            distractor,
            comparte: await comparteVocabulario(
              distractor.codigo,
              distractor.version,
              resultado.consultaNormalizada,
            ),
          }).toEqual({ distractor, comparte: true });
          if (distractor.difiereEn === 'version') {
            expect(
              resultado.politicas.some(
                (p) => p.codigo === distractor.codigo && p.version === distractor.version,
              ),
            ).toBe(false);
          }
        }
        for (const p of resultado.politicas) {
          const [fila] = await dataSource.query<{ contenido: string }[]>(
            `SELECT contenido FROM conocimiento.versiones_politica WHERE politica_codigo = $1 AND version = $2`,
            [p.codigo, p.version],
          );
          // Posicion exacta del extracto citado (HU-05).
          expect(
            [...(fila?.contenido ?? '')].slice(p.extracto.inicio, p.extracto.fin).join(''),
          ).toBe(p.extracto.texto);
          expect(p.relevancia).toBeGreaterThanOrEqual(UMBRAL_RELEVANCIA_POR_DEFECTO);
        }
      },
    );

    // Jest no admite `it.each` con una tabla vacia: el corpus adversarial no tiene estos casos.
    if (sinResultados.length > 0) {
      it.each(sinResultados.map((c) => [c.id, c] as const))(
        '%s: declara explicitamente que no hay politica aplicable (HU-07)',
        async (_id, caso) => {
          expect(await buscar(caso.consulta)).toMatchObject({
            tipo: 'sin-resultados',
            motivo: caso.motivo,
          });
        },
      );
    }
  },
);

describe('BuscarPoliticaUseCase: garantias generales', () => {
  beforeAll(() => restablecer());

  it('el corpus estandar nunca devuelve una politica adversarial', async () => {
    const resultado = await buscar('normas de uso responsable del aula virtual', {
      umbralRelevancia: 0,
    });
    const codigos =
      resultado.tipo === 'encontradas' ? resultado.politicas.map((p) => p.codigo) : [];
    expect(codigos).not.toContain('POL-AV-006');
  });

  it('desempata por codigo ascendente, nunca por orden de insercion', async () => {
    const politica = (codigo: string) => ({
      codigo,
      alcance: `Alcance de ${codigo}`,
      dependenciaResponsable: 'Dependencia de prueba',
      enlace: null,
      adversarial: false,
      origen: 'complemento-hu-kb-04' as const,
      categorias: ['plazos'],
      servicios: ['matricula'],
      versiones: [
        {
          version: '1.0',
          titulo: 'Constancias',
          vigenteDesde: '2026-01-01',
          vigente: true,
          extractos: ['Las solicitudes de constancia se radican en línea.'],
        },
      ],
    });
    // Se insertan en orden inverso al esperado.
    const sintetica: SemillaConocimiento = {
      ...semilla,
      politicas: [politica('POL-ZZ-003'), politica('POL-ZZ-001'), politica('POL-ZZ-002')],
    };
    await repositorio.restablecer(construirEstadoConocimiento(sintetica));
    try {
      const resultado = await buscar('solicitudes de constancia');
      expect(resultado.tipo).toBe('encontradas');
      if (resultado.tipo === 'encontradas') {
        expect(resultado.politicas.map((p) => p.codigo)).toEqual([
          'POL-ZZ-001',
          'POL-ZZ-002',
          'POL-ZZ-003',
        ]);
        expect(new Set(resultado.politicas.map((p) => p.relevancia)).size).toBe(1);
      }
    } finally {
      await restablecer();
    }
  });

  it('devuelve como maximo tres politicas, por relevancia descendente y codigo ascendente', async () => {
    const resultado = await buscar('solicitud de la cuenta en la mesa de ayuda', {
      umbralRelevancia: 0,
    });
    expect(resultado.tipo).toBe('encontradas');
    if (resultado.tipo === 'encontradas') {
      expect(resultado.politicas).toHaveLength(3);
      for (let i = 1; i < resultado.politicas.length; i++) {
        const anterior = resultado.politicas[i - 1];
        const actual = resultado.politicas[i];
        expect(
          anterior &&
            actual &&
            (anterior.relevancia > actual.relevancia ||
              (anterior.relevancia === actual.relevancia && anterior.codigo < actual.codigo)),
        ).toBe(true);
      }
    }
  });

  it('solo considera versiones vigentes', async () => {
    // «captura de pantalla» solo aparece en la version 1.0, no vigente, de POL-AV-002.
    const resultado = await buscar('captura de pantalla del error', { umbralRelevancia: 0 });
    const citadas = resultado.tipo === 'encontradas' ? resultado.politicas : [];
    const [{ vigentes }] = await dataSource.query<{ vigentes: string[] }[]>(
      `SELECT array_agg(politica_codigo || '@' || version) AS vigentes FROM conocimiento.versiones_politica WHERE vigente`,
    );
    for (const p of citadas) {
      expect(vigentes).toContain(`${p.codigo}@${p.version}`);
    }
  });

  it('aplica los filtros de servicio y categoria', async () => {
    const resultado = await new BuscarPoliticaUseCase(
      repositorio,
      configuracion({ umbralRelevancia: 0 }),
    ).ejecutar({ texto: 'solicitud', servicio: 'matricula', categoria: 'plazos' });
    const politicas = resultado.tipo === 'encontradas' ? resultado.politicas : [];
    expect(politicas.length).toBeGreaterThan(0);
    for (const p of politicas) {
      expect(p.servicios).toContain('matricula');
      expect(p.categorias).toContain('plazos');
    }
  });
});

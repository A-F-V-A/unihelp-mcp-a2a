import * as semillaJson from '../../seeds/conocimiento.semilla.json';
import type { PoliticaEncontrada } from '../dominio/busqueda';
import {
  CategoriaNoEncontradaError,
  ConsultaInvalidaError,
  RestablecimientoNoPermitidoError,
  SeleccionEstadoInvalidaError,
  ServicioNoEncontradoError,
} from '../dominio/errores';
import type { EstadoConocimiento } from '../dominio/grafo';
import type {
  CandidatosBusqueda,
  ConocimientoRepository,
} from '../dominio/puertos/conocimiento.repository';
import { construirEstadoConocimiento, validarSemilla } from '../dominio/reglas/semilla.rules';
import { BuscarPoliticaUseCase } from './buscar-politica.use-case';
import type { ConfiguracionConocimiento } from './configuracion';
import { ConsultarComponentesDeServicioUseCase } from './consultar-componentes-de-servicio.use-case';
import { ConsultarPoliticasDeCategoriaUseCase } from './consultar-politicas-de-categoria.use-case';
import { calcularHuella } from './huella';
import { RestablecerConocimientoUseCase } from './restablecer-conocimiento.use-case';
import { SembrarConocimientoUseCase } from './sembrar-conocimiento.use-case';

const semilla = validarSemilla((semillaJson as { default?: unknown }).default ?? semillaJson);
const estadoSemilla = construirEstadoConocimiento(semilla);

function repositorioFalso(): jest.Mocked<ConocimientoRepository> {
  return {
    buscarPoliticasVigentes: jest.fn(),
    obtenerComponentesDeServicio: jest.fn(),
    obtenerPoliticasDeCategoria: jest.fn(),
    sembrarSiVacia: jest.fn(),
    restablecer: jest.fn(),
    leerEstado: jest.fn(),
  };
}

function configuracion(
  parcial: Partial<ConfiguracionConocimiento> = {},
): ConfiguracionConocimiento {
  return {
    urlBaseDatos: 'postgres://x',
    umbralRelevancia: 0.05,
    restablecimientoPermitido: false,
    ...parcial,
  };
}

const politica: PoliticaEncontrada = {
  codigo: 'POL-MA-001',
  version: '1.1',
  titulo: 'Cancelación',
  alcance: 'Pregrado',
  categorias: ['academico'],
  servicios: ['matricula'],
  relevancia: 0.2,
  extracto: { ordinal: 1, inicio: 0, fin: 5, texto: 'Texto' },
};

describe('BuscarPoliticaUseCase', () => {
  const candidatos = (parcial: Partial<CandidatosBusqueda>): CandidatosBusqueda => ({
    consultaNormalizada: "'cancel'",
    terminos: 1,
    coincidencias: 1,
    politicas: [politica],
    ...parcial,
  });

  it('pide como maximo tres politicas con el umbral configurado y la consulta normalizada', async () => {
    const repo = repositorioFalso();
    repo.buscarPoliticasVigentes.mockResolvedValue(candidatos({}));
    await new BuscarPoliticaUseCase(repo, configuracion({ umbralRelevancia: 0.07 })).ejecutar({
      texto: '  cancelar   asignatura ',
      servicio: 'matricula',
    });
    expect(repo.buscarPoliticasVigentes).toHaveBeenCalledWith({
      texto: 'cancelar asignatura',
      servicio: 'matricula',
      categoria: null,
      umbral: 0.07,
      limite: 3,
    });
  });

  it('devuelve las politicas encontradas', async () => {
    const repo = repositorioFalso();
    repo.buscarPoliticasVigentes.mockResolvedValue(candidatos({}));
    await expect(
      new BuscarPoliticaUseCase(repo, configuracion()).ejecutar({ texto: 'cancelar' }),
    ).resolves.toEqual({
      tipo: 'encontradas',
      consultaNormalizada: "'cancel'",
      umbral: 0.05,
      politicas: [politica],
    });
  });

  it.each([
    ['consulta-sin-terminos', { terminos: 0, coincidencias: 0, politicas: [] }],
    ['sin-coincidencias', { coincidencias: 0, politicas: [] }],
    ['bajo-umbral', { coincidencias: 4, politicas: [] }],
  ] as const)(
    'declara la ausencia con motivo %s en vez de forzar un resultado (HU-07)',
    async (motivo, parcial) => {
      const repo = repositorioFalso();
      repo.buscarPoliticasVigentes.mockResolvedValue(candidatos(parcial));
      const resultado = await new BuscarPoliticaUseCase(repo, configuracion()).ejecutar({
        texto: 'algo que buscar',
      });
      expect(resultado).toEqual({
        tipo: 'sin-resultados',
        motivo,
        consultaNormalizada: "'cancel'",
        umbral: 0.05,
      });
    },
  );

  it('rechaza una consulta invalida sin tocar la base', async () => {
    const repo = repositorioFalso();
    await expect(
      new BuscarPoliticaUseCase(repo, configuracion()).ejecutar({ texto: 'x' }),
    ).rejects.toBeInstanceOf(ConsultaInvalidaError);
    expect(repo.buscarPoliticasVigentes).not.toHaveBeenCalled();
  });
});

describe('consultas del grafo', () => {
  it('traduce un servicio inexistente a ServicioNoEncontradoError', async () => {
    const repo = repositorioFalso();
    repo.obtenerComponentesDeServicio.mockResolvedValue(null);
    await expect(
      new ConsultarComponentesDeServicioUseCase(repo).ejecutar('biblioteca'),
    ).rejects.toBeInstanceOf(ServicioNoEncontradoError);
  });

  it('traduce una categoria inexistente a CategoriaNoEncontradaError', async () => {
    const repo = repositorioFalso();
    repo.obtenerPoliticasDeCategoria.mockResolvedValue(null);
    await expect(
      new ConsultarPoliticasDeCategoriaUseCase(repo).ejecutar('finanzas'),
    ).rejects.toBeInstanceOf(CategoriaNoEncontradaError);
  });
});

describe('RestablecerConocimientoUseCase (HU-36)', () => {
  const permitido = () => configuracion({ restablecimientoPermitido: true });

  it('fuera del perfil permitido falla sin tocar la base', async () => {
    const repo = repositorioFalso();
    const caso = new RestablecerConocimientoUseCase(repo, configuracion(), semilla);
    await expect(caso.ejecutar()).rejects.toBeInstanceOf(RestablecimientoNoPermitidoError);
    expect(repo.restablecer).not.toHaveBeenCalled();
  });

  it('por defecto escribe todo_operativo con corpus estandar', async () => {
    const repo = repositorioFalso();
    repo.restablecer.mockImplementation(async (estado: EstadoConocimiento) => estado);
    const resultado = await new RestablecerConocimientoUseCase(
      repo,
      permitido(),
      semilla,
    ).ejecutar();
    expect(repo.restablecer).toHaveBeenCalledWith(estadoSemilla);
    expect(resultado).toMatchObject({
      huella: calcularHuella(estadoSemilla),
      versionSemilla: semilla.versionSemilla,
      estadoInicial: 'todo_operativo',
      corpus: 'estandar',
    });
    expect(resultado.conteos.politicas).toBe(
      semilla.politicas.filter((p) => !p.adversarial).length,
    );
  });

  it('escribe la variante pedida', async () => {
    const repo = repositorioFalso();
    repo.restablecer.mockImplementation(async (estado: EstadoConocimiento) => estado);
    const seleccion = { estadoInicial: 'au_fuera_total', corpus: 'adversarial' } as const;
    const resultado = await new RestablecerConocimientoUseCase(repo, permitido(), semilla).ejecutar(
      seleccion,
    );
    expect(resultado.huella).toBe(calcularHuella(construirEstadoConocimiento(semilla, seleccion)));
    expect(resultado.conteos.politicas).toBe(semilla.politicas.length);
  });

  it('rechaza una variante inexistente sin tocar la base', async () => {
    const repo = repositorioFalso();
    await expect(
      new RestablecerConocimientoUseCase(repo, permitido(), semilla).ejecutar({
        estadoInicial: 'biblioteca_caida',
      }),
    ).rejects.toBeInstanceOf(SeleccionEstadoInvalidaError);
    expect(repo.restablecer).not.toHaveBeenCalled();
  });
});

describe('SembrarConocimientoUseCase', () => {
  it('informa si sembro o si la base ya tenia la semilla', async () => {
    const repo = repositorioFalso();
    repo.sembrarSiVacia.mockResolvedValue({ accion: 'sin-cambios', estado: estadoSemilla });
    await expect(new SembrarConocimientoUseCase(repo, semilla).ejecutar()).resolves.toMatchObject({
      accion: 'sin-cambios',
      huella: calcularHuella(estadoSemilla),
    });
  });
});

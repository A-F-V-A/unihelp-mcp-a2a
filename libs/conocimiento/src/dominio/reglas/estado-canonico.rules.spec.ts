import * as semillaJson from '../../../seeds/conocimiento.semilla.json';
import type { EstadoConocimiento } from '../grafo';
import { compararTexto, contarFilas, serializarEstadoCanonico } from './estado-canonico.rules';
import { construirEstadoConocimiento, validarSemilla } from './semilla.rules';

const semilla = validarSemilla((semillaJson as { default?: unknown }).default ?? semillaJson);
const estado = construirEstadoConocimiento(semilla, { estadoInicial: 'av_mantenimiento' });

function invertirTodo(e: EstadoConocimiento): EstadoConocimiento {
  return {
    servicios: [...e.servicios].reverse(),
    estadosServicio: [...e.estadosServicio].reverse(),
    componentes: [...e.componentes].reverse(),
    categorias: [...e.categorias].reverse(),
    politicas: [...e.politicas].reverse(),
    versiones: [...e.versiones].reverse(),
    extractos: [...e.extractos].reverse(),
    serviciosComponentes: [...e.serviciosComponentes].reverse(),
    politicasCategorias: [...e.politicasCategorias].reverse(),
    politicasServicios: [...e.politicasServicios].reverse(),
    entorno: e.entorno,
  };
}

describe('serializarEstadoCanonico', () => {
  it('no depende del orden de las filas', () => {
    expect(serializarEstadoCanonico(invertirTodo(estado))).toBe(serializarEstadoCanonico(estado));
  });

  it('cambia si cambia cualquier columna', () => {
    const [primero, ...resto] = estado.componentes;
    const alterado = {
      ...estado,
      componentes: [{ ...primero, nombre: `${primero.nombre}.` }, ...resto],
    };
    expect(serializarEstadoCanonico(alterado)).not.toBe(serializarEstadoCanonico(estado));
  });

  it('distingue una ventana ausente de una presente', () => {
    const conVentana = estado.estadosServicio.find((e) => e.ventanaEstimada !== null);
    expect(conVentana).toBeDefined();
    const sinVentana = estado.estadosServicio.map((e) =>
      e === conVentana ? { ...e, ventanaEstimada: null } : e,
    );
    expect(serializarEstadoCanonico({ ...estado, estadosServicio: sinVentana })).not.toBe(
      serializarEstadoCanonico(estado),
    );
  });

  it('dos variantes distintas nunca serializan igual', () => {
    const envenenado = construirEstadoConocimiento(semilla, {
      estadoInicial: 'au_degradado_total_envenenado',
    });
    const normal = construirEstadoConocimiento(semilla, { estadoInicial: 'au_degradado_total' });
    expect(serializarEstadoCanonico(envenenado)).not.toBe(serializarEstadoCanonico(normal));
  });
});

describe('compararTexto', () => {
  it('ordena por punto de codigo como COLLATE "C", no por idioma', () => {
    expect(['b', 'a', 'B', 'á', 'Z'].sort(compararTexto)).toEqual(['B', 'Z', 'a', 'b', 'á']);
  });

  it('pone primero el prefijo mas corto', () => {
    expect(compararTexto('POL-AV-00', 'POL-AV-001')).toBeLessThan(0);
  });
});

describe('contarFilas', () => {
  it('cuenta cada tabla del corpus estandar y del adversarial', () => {
    expect(contarFilas(construirEstadoConocimiento(semilla))).toEqual(CONTEOS_ESTANDAR);
    expect(contarFilas(construirEstadoConocimiento(semilla, { corpus: 'adversarial' }))).toEqual(
      CONTEOS_ADVERSARIAL,
    );
  });
});

const CONTEOS_ESTANDAR = {
  servicios: 4,
  estados_servicio: 4,
  componentes: 13,
  categorias: 5,
  politicas: 36,
  versiones_politica: 49,
  extractos: 143,
  servicio_componente: 13,
  politica_categoria: 36,
  politica_servicio: 36,
  entorno: 1,
};

const CONTEOS_ADVERSARIAL = {
  ...CONTEOS_ESTANDAR,
  politicas: 39,
  versiones_politica: 55,
  extractos: 162,
  politica_categoria: 39,
  politica_servicio: 39,
};

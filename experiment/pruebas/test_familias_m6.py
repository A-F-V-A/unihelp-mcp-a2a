"""M6.1-M6.5 calculadas a mano sobre insumos diminutos (decision 60)."""

from __future__ import annotations

import dataclasses

import pytest

from analisis.familias import m6_modularidad as m6
from analisis.familias.comun import evaluar_umbral

MINUTO = 60 * 10**9


def _archivo(ruta: str, clase: str, mas: int, menos: int, estado: str = 'M') -> dict:
    return {'ruta': ruta, 'estado': estado, 'clase': clase, 'anadidas': mas, 'eliminadas': menos}


REPOSITORIO = {
    'base': 'abc1234',
    'rama_base': 'm6-base',
    'implementaciones': [
        {
            'arquitectura': 'B1',
            'rama': 'm6/b1',
            'commit': 'b1',
            'archivos': [
                _archivo('libs/x.ts', 'fuente', 100, 10, 'A'),
                _archivo('apps/m/README.md', 'documentacion', 5, 5),
                _archivo('libs/x.spec.ts', 'prueba', 80, 0, 'A'),
                _archivo('apps/m/contrato/x.instantanea.json', 'generado', 70, 0, 'A'),
            ],
        },
        {
            'arquitectura': 'B0',
            'rama': 'm6/b0',
            'commit': 'b0',
            'archivos': [
                _archivo('libs/x.ts', 'fuente', 50, 0, 'A'),
                _archivo('apps/b0/project.json', 'configuracion', 7, 1),
            ],
        },
    ],
}

VERIFICACION = {
    'base': 'abc1234',
    'rama_base': 'm6-base',
    'implementaciones': [
        {
            'arquitectura': 'B0',
            'servicios_reiniciados': ['b0-directo'],
            'marcas': [
                {'fase': 'planificacion', 'evento': 'inicio', 'monotono_ns': 0},
                {'fase': 'planificacion', 'evento': 'fin', 'monotono_ns': 1 * MINUTO},
                {'fase': 'pruebas', 'evento': 'inicio', 'monotono_ns': 4 * MINUTO},
                {'fase': 'pruebas', 'evento': 'fin', 'monotono_ns': 10 * MINUTO},
            ],
        },
        {
            'arquitectura': 'B1',
            'servicios_reiniciados': [],
            'marcas': [{'fase': 'planificacion', 'evento': 'inicio', 'monotono_ns': 0}],
        },
        {'arquitectura': 'B3', 'servicios_reiniciados': None, 'marcas': []},
    ],
}

CONTINUA = {
    'base': 'abc1234',
    'rama_base': 'm6-base',
    'implementaciones': [
        {'arquitectura': 'B0', 'suite_verde': True, 'pruebas_previas_editadas': []},
        {'arquitectura': 'B1', 'suite_verde': True, 'pruebas_previas_editadas': ['libs/viejo.spec.ts']},
        {'arquitectura': 'B2', 'suite_verde': False, 'pruebas_previas_editadas': []},
    ],
}


@pytest.fixture
def ctx(contexto):
    return dataclasses.replace(
        contexto,
        insumos={
            **contexto.insumos,
            'repositorio': REPOSITORIO,
            'verificacion_manual': VERIFICACION,
            'integracion_continua': CONTINUA,
        },
    )


def test_m6_1_excluye_pruebas_y_generados(registro, ctx):
    r = m6.archivos_modificados(registro.metrica('M6.1'), ctx)
    assert r.valor('archivos', 'B1') == 2
    assert r.valor('archivos_con_pruebas', 'B1') == 4
    assert r.valor('archivos', 'B0') == 2
    assert r.valor('archivos', 'B1', clase='generado') == 1


def test_m6_2_lineas_netas_sin_pruebas(registro, ctx):
    r = m6.lineas_netas(registro.metrica('M6.2'), ctx)
    assert r.valor('lineas_netas', 'B1') == 90
    assert r.valor('anadidas', 'B1') == 105
    assert r.valor('eliminadas', 'B1') == 15
    assert r.valor('lineas_prueba_netas', 'B1') == 80
    assert r.valor('lineas_netas', 'B0') == 56


def test_m6_3_cuenta_servicios_y_evalua_el_umbral_de_las_arquitecturas_mcp(registro, ctx):
    metrica = registro.metrica('M6.3')
    r = m6.servicios_reiniciados(metrica, ctx)
    assert r.valor('servicios', 'B0') == 1
    assert r.valor('servicios', 'B1') == 0
    assert r.valor('servicios', 'B3') is None
    assert r.observado_umbral == {'B0': 1.0, 'B1': 0.0, 'B3': None}
    umbral = metrica.datos['valor_umbral']
    # B3 sin verificar: el umbral (B1 y B3 == 1) no se puede evaluar.
    assert evaluar_umbral(umbral, r.observado_umbral) is None
    assert evaluar_umbral(umbral, {'B0': 2.0, 'B1': 1.0, 'B3': 1.0}) is True
    assert evaluar_umbral(umbral, {'B1': 0.0, 'B3': 1.0}) is False


def test_m6_4_resta_relojes_monotonos_y_desglosa_por_fase(registro, ctx):
    r = m6.minutos_hasta_verde(registro.metrica('M6.4'), ctx)
    assert r.valor('minutos', 'B0') == pytest.approx(10.0)
    assert r.valor('minutos', 'B0', fase='planificacion') == pytest.approx(1.0)
    assert r.valor('minutos', 'B0', fase='pruebas') == pytest.approx(6.0)
    assert r.valor('minutos', 'B0', fase='implementacion') is None
    assert r.valor('minutos', 'B1') is None


def test_m6_5_cero_si_se_edito_una_prueba_previa_o_la_suite_no_paso(registro, ctx):
    r = m6.regresion_sin_tocar_pruebas(registro.metrica('M6.5'), ctx)
    assert r.observado_umbral == {'B0': 1.0, 'B1': 0.0, 'B2': 0.0}
    assert any('B1' in nota for nota in r.notas)


def test_sin_insumos_m6_queda_sin_datos(registro, contexto):
    vacio = dataclasses.replace(
        contexto,
        insumos={**contexto.insumos, 'repositorio': None, 'verificacion_manual': None, 'integracion_continua': None},
    )
    for codigo, funcion in (
        ('M6.1', m6.archivos_modificados),
        ('M6.2', m6.lineas_netas),
        ('M6.3', m6.servicios_reiniciados),
        ('M6.4', m6.minutos_hasta_verde),
        ('M6.5', m6.regresion_sin_tocar_pruebas),
    ):
        assert funcion(registro.metrica(codigo), vacio).estado == 'sin_datos', codigo

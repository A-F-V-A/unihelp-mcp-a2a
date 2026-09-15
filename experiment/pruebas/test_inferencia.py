"""Remuestreo pareado por conglomerados: tareas, nunca ejecuciones (HU-MET-05)."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from analisis.inferencia import (
    ConfiguracionBootstrap,
    MatrizTareas,
    bootstrap_contraste,
    bootstrap_por_arquitectura,
    indices_remuestreo,
)

ARQUITECTURAS = ('B0', 'B1', 'B2', 'B3')
CONFIG = ConfiguracionBootstrap(replicas=10_000, nivel=0.95, semilla=20261014)


def _matriz(n_tareas: int = 40, semilla: int = 7) -> MatrizTareas:
    generador = np.random.default_rng(semilla)
    valores = generador.uniform(0, 1, size=(n_tareas, len(ARQUITECTURAS)))
    return MatrizTareas(valores, [f'T-INF-{i:03d}' for i in range(n_tareas)], ARQUITECTURAS)


def test_la_misma_semilla_produce_el_mismo_intervalo():
    primera = bootstrap_por_arquitectura(_matriz(), 'media', CONFIG)
    segunda = bootstrap_por_arquitectura(_matriz(), 'media', CONFIG)
    assert primera == segunda
    assert bootstrap_contraste(_matriz(), 'B1', 'B0', 'mediana', CONFIG) == bootstrap_contraste(
        _matriz(), 'B1', 'B0', 'mediana', CONFIG
    )


def test_otra_semilla_produce_otro_intervalo():
    otra = ConfiguracionBootstrap(replicas=10_000, nivel=0.95, semilla=1)
    assert bootstrap_por_arquitectura(_matriz(), 'media', CONFIG)['B0'].intervalo != (
        bootstrap_por_arquitectura(_matriz(), 'media', otra)['B0'].intervalo
    )


def test_remuestrea_tareas_con_reemplazo_con_el_numero_pedido_de_replicas():
    indices = indices_remuestreo(40, CONFIG)
    assert indices.shape == (10_000, 40)
    assert indices.min() == 0 and indices.max() == 39
    # Con reemplazo: practicamente toda replica repite alguna tarea.
    assert np.mean([len(set(fila)) < 40 for fila in indices[:500]]) > 0.99


def test_el_intervalo_es_del_95_por_ciento_y_contiene_el_valor_puntual():
    estimacion = bootstrap_por_arquitectura(_matriz(), 'media', CONFIG)['B2']
    assert estimacion.intervalo is not None
    assert estimacion.intervalo.nivel == 0.95
    assert estimacion.intervalo.inferior <= estimacion.valor <= estimacion.intervalo.superior
    assert estimacion.n_tareas == 40


def test_arrastra_juntas_las_arquitecturas_de_cada_tarea():
    # B1 es exactamente B0 + 0,1 en cada tarea, aunque las tareas varien mucho entre si.
    # Si se remuestrearan arquitecturas o ejecuciones por separado, el intervalo de la
    # diferencia seria ancho; con el pareo por tarea es exactamente [0,1; 0,1].
    base = np.linspace(0.0, 0.8, 40)
    valores = np.column_stack([base, base + 0.1, base, base])
    matriz = MatrizTareas(valores, [f'T-DIA-{i:03d}' for i in range(40)], ARQUITECTURAS)
    contraste = bootstrap_contraste(matriz, 'B1', 'B0', 'media', CONFIG)
    assert contraste.valor == pytest.approx(0.1)
    assert contraste.intervalo.inferior == pytest.approx(0.1)
    assert contraste.intervalo.superior == pytest.approx(0.1)
    # Los intervalos marginales, en cambio, son anchos: la variabilidad entre tareas es real.
    marginal = bootstrap_por_arquitectura(matriz, 'media', CONFIG)['B1'].intervalo
    assert marginal.superior - marginal.inferior > 0.1


def test_es_imposible_pasarle_una_tabla_de_ejecuciones():
    ejecuciones = pd.DataFrame(
        {'tarea': ['T-INF-001'] * 8, 'arquitectura': list(ARQUITECTURAS) * 2, 'exito': [1.0] * 8}
    )
    with pytest.raises(TypeError, match='TAREAS, no sobre ejecuciones'):
        bootstrap_por_arquitectura(ejecuciones, 'media', CONFIG)
    with pytest.raises(TypeError, match='MatrizTareas'):
        bootstrap_contraste(ejecuciones.to_numpy(), 'B1', 'B0', 'media', CONFIG)


def test_la_matriz_rechaza_filas_repetidas_por_tarea_y_arquitectura():
    ejecuciones = pd.DataFrame(
        {
            'tarea': ['T-INF-001'] * 8,
            'arquitectura': list(ARQUITECTURAS) * 2,
            'exito': [1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0],
        }
    )
    with pytest.raises(ValueError, match='tabla de ejecuciones'):
        MatrizTareas.desde_tabla(
            ejecuciones,
            columna_tarea='tarea',
            columna_arquitectura='arquitectura',
            columna_valor='exito',
            arquitecturas=ARQUITECTURAS,
        )
    with pytest.raises(ValueError, match='tareas repetidas'):
        MatrizTareas(np.ones((2, 4)), ['T-INF-001', 'T-INF-001'], ARQUITECTURAS)


def test_una_celda_sin_dato_no_rompe_el_pareo():
    valores = np.array([[1.0, 0.0, 1.0, 1.0], [0.0, np.nan, 1.0, 1.0], [1.0, 1.0, 0.0, 1.0]])
    matriz = MatrizTareas(valores, ['T-INF-001', 'T-INF-002', 'T-INF-003'], ARQUITECTURAS)
    estimaciones = bootstrap_por_arquitectura(matriz, 'media', CONFIG)
    assert estimaciones['B1'].n_tareas == 2
    assert estimaciones['B1'].valor == pytest.approx(0.5)
    assert bootstrap_contraste(matriz, 'B1', 'B0', 'media', CONFIG).n_tareas == 2


def test_configuracion_invalida():
    with pytest.raises(ValueError):
        ConfiguracionBootstrap(replicas=0, nivel=0.95, semilla=1)
    with pytest.raises(ValueError):
        ConfiguracionBootstrap(replicas=100, nivel=1.5, semilla=1)

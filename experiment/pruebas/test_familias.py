"""Valores de M1, M4 y M7 calculados a mano sobre una corrida diminuta."""

from __future__ import annotations

import copy
import json
from datetime import UTC, datetime

import pytest

from analisis.carga import consolidar
from analisis.familias import calcular
from analisis.familias.comun import evaluar_umbral
from analisis.salida import construir_resultados
from conftest import construir_contexto, escribir_jsonl, leer_traza_valida

# (tarea, arquitectura) -> [(estado, exito, latencia_ms)] por repeticion.
PLAN = {
    ('T-INF-001', 'B0'): [('ok', True, 1000), ('ok', True, 3000)],
    ('T-INF-001', 'B1'): [('ok', True, 2000), ('ok', False, 4000)],
    ('T-INF-001', 'B2'): [('ok', False, 5000), ('ok', False, 7000)],
    ('T-INF-001', 'B3'): [('ok', True, 6000), ('ok', True, 6000)],
    ('T-COM-001', 'B0'): [('ok', True, 10000), ('ok', False, 12000)],
    ('T-COM-001', 'B1'): [('ok', True, 9000), ('ok', True, 9000)],
    ('T-COM-001', 'B2'): [('timeout', False, 120500), ('ok', True, 14000)],
    ('T-COM-001', 'B3'): [('limite_herramientas', False, 30000), ('error_agente', False, 20000)],
}


def _traza(tarea: str, arquitectura: str, repeticion: int, estado: str, latencia: int) -> dict:
    traza = copy.deepcopy(leer_traza_valida())
    traza.update(task_id=tarea, condition=arquitectura, repetition=repeticion)
    traza['run_id'] = f'{tarea}|{arquitectura}|r{repeticion}|x'
    traza['timing']['total_ms'] = latencia
    traza['timing']['breakdown'] = {
        'llm_ms': latencia - 300, 'tool_exec_ms': 200, 'transport_ms': 50, 'orchestration_ms': 50,
    }
    traza['a2a']['mensajes_totales'] = 0 if arquitectura in ('B0', 'B1') else 4
    traza['usage'].update(input_tokens=1000 * repeticion, output_tokens=100, llm_calls=repeticion)
    traza['outcome']['status'] = estado
    return traza


@pytest.fixture(scope='module')
def diminuta(tmp_path_factory, registro):
    corrida = tmp_path_factory.mktemp('diminuta')
    trazas, puntuaciones = [], []
    for (tarea, arquitectura), repeticiones in PLAN.items():
        for numero, (estado, exito, latencia) in enumerate(repeticiones, start=1):
            traza = _traza(tarea, arquitectura, numero, estado, latencia)
            trazas.append(traza)
            puntuaciones.append({'run_id': traza['run_id'], 'exito': exito})
    escribir_jsonl(corrida / 'trazas.jsonl', trazas)
    escribir_jsonl(corrida / 'puntuaciones.jsonl', puntuaciones)
    consolidado = consolidar(corrida, registro)
    assert not consolidado.rechazos
    contexto = construir_contexto(registro, consolidado, corrida, tmp_path_factory.mktemp('intermedios'))
    return contexto, consolidado, calcular(contexto)


def test_m1_1_promedia_dentro_de_cada_tarea_y_luego_entre_tareas(diminuta):
    _, _, r = diminuta
    esperado = {'B0': (1.0 + 0.5) / 2, 'B1': (0.5 + 1.0) / 2, 'B2': (0.0 + 0.5) / 2, 'B3': (1.0 + 0.0) / 2}
    for arquitectura, valor in esperado.items():
        assert r['M1.1'].valor('media_entre_tareas', arquitectura) == pytest.approx(valor)
    contraste = next(c for c in r['M1.1'].contrastes if (c.minuendo, c.sustraendo) == ('B1', 'B0'))
    assert contraste.estimacion.valor == pytest.approx(0.0)
    assert contraste.estimacion.n_tareas == 2


def test_m1_2_por_categoria(diminuta):
    _, _, r = diminuta
    assert r['M1.2'].valor('media_entre_tareas', 'B2', categoria='compuesta') == pytest.approx(0.5)
    assert r['M1.2'].valor('media_entre_tareas', 'B3', categoria='informativa') == pytest.approx(1.0)


def test_m1_3_y_m1_4(diminuta):
    _, _, r = diminuta
    assert {a: r['M1.3'].valor('media_entre_tareas', a) for a in ('B0', 'B1', 'B2', 'B3')} == {
        'B0': 0.5, 'B1': 0.5, 'B2': 0.0, 'B3': 0.5,
    }
    assert {a: r['M1.4'].valor('media_entre_tareas', a) for a in ('B0', 'B1', 'B2', 'B3')} == {
        'B0': 0.5, 'B1': 0.5, 'B2': 0.5, 'B3': 0.0,
    }


def test_m1_5_separa_estado_final_de_fallo_de_rubrica(diminuta):
    _, _, r = diminuta
    m15 = r['M1.5']
    assert m15.valor('conteo', 'B2', tipo_fallo='timeout') == 1
    assert m15.valor('conteo', 'B2', tipo_fallo='fallo_rubrica') == 2
    assert m15.valor('conteo', 'B3', tipo_fallo='limite_herramientas') == 1
    assert m15.valor('conteo', 'B3', tipo_fallo='error_agente') == 1
    assert m15.valor('proporcion_de_fallos', 'B2', tipo_fallo='fallo_rubrica') == pytest.approx(2 / 3)


def test_m4_1_solo_usa_ejecuciones_terminadas_y_mediana_de_medianas(diminuta):
    _, _, r = diminuta
    assert r['M4.1'].valor('mediana_entre_tareas', 'B0') == pytest.approx((2000 + 11000) / 2)
    # B2: el timeout se excluye de latencia; T-COM-001 solo aporta 14000.
    assert r['M4.1'].valor('mediana_entre_tareas', 'B2') == pytest.approx((6000 + 14000) / 2)
    # B3 en T-COM-001 no termino ninguna vez: esa tarea no tiene latencia.
    fila_b3 = next(f for f in r['M4.1'].filas if f.arquitectura == 'B3' and f.estadistico == 'mediana_entre_tareas')
    assert fila_b3.valor == pytest.approx(6000) and fila_b3.n_tareas == 1


def test_m4_2_componentes_y_residuo(diminuta):
    _, _, r = diminuta
    assert r['M4.2'].valor('mediana_entre_tareas', 'B1', componente='orquestacion') == 50
    proporcion = r['M4.2'].observado_umbral['B1']
    # Mediana por tarea (T-INF-001: 2000 y 4000 ms; T-COM-001: 9000 y 9000 ms) y luego entre tareas.
    assert proporcion == pytest.approx(((50 / 2000 + 50 / 4000) / 2 + 50 / 9000) / 2)


def test_m4_6_y_m4_7_incluyen_lo_consumido_por_ejecuciones_fallidas(diminuta):
    _, _, r = diminuta
    # B3 en T-COM-001 fallo dos veces, pero su consumo cuenta: mediana de 1100 y 2100.
    assert r['M4.6'].valor('suma_corrida', 'B3', tokens='total') == 1100 + 2100 + 1100 + 2100
    assert r['M4.7'].valor('proyeccion_1000_solicitudes', 'B0') == pytest.approx(
        r['M4.7'].valor('mediana_entre_tareas', 'B0') * 1000
    )


def test_m7_sin_insumos_queda_sin_datos_y_no_en_cero(diminuta):
    _, _, r = diminuta
    assert r['M7.1'].observado_umbral == 1.0
    assert r['M7.3'].observado_umbral == 0.0
    for codigo in ('M7.2', 'M7.4', 'M7.5', 'M7.6', 'M7.7'):
        assert r[codigo].estado == 'sin_datos', codigo
    assert r['M4.3'].estado == 'sin_datos'


def test_sin_puntuaciones_m1_queda_sin_datos(tmp_path, registro, diminuta):
    contexto, consolidado, _ = diminuta
    (tmp_path / 'trazas.jsonl').write_text(
        (contexto.directorio_corrida / 'trazas.jsonl').read_text(encoding='utf-8'), encoding='utf-8'
    )
    sin_puntuaciones = consolidar(tmp_path, registro)
    r = calcular(construir_contexto(registro, sin_puntuaciones, tmp_path, tmp_path / 'intermedios'))
    assert r['M1.1'].estado == 'sin_datos'
    assert 'puntuaciones' in r['M1.1'].motivo_estado


def test_evaluar_umbral():
    assert evaluar_umbral({'operador': '>=', 'valor': 0.98}, 0.99) is True
    assert evaluar_umbral({'operador': '<', 'valor': 0.03}, 0.03) is False
    assert evaluar_umbral({'operador': '==', 'valor': 1}, 1.0) is True
    assert evaluar_umbral({'operador': '<', 'valor': 0.15}, {'B0': 0.1, 'B1': 0.2}) is False
    assert evaluar_umbral({'operador': '>=', 'valor': 0.85, 'arquitecturas': ['B2']}, {'B1': 0.1, 'B2': 0.9}) is True
    assert evaluar_umbral({'operador': 'igual_entre_arquitecturas', 'arquitecturas': ['B2', 'B3']}, {'B2': 4, 'B3': 4}) is True
    assert evaluar_umbral({'operador': 'igual_entre_arquitecturas', 'arquitecturas': ['B2', 'B3']}, {'B2': 4, 'B3': 5}) is False
    assert evaluar_umbral({'operador': '>=', 'valor': 0.75}, None) is None


def _claves(nodo) -> set[str]:
    if isinstance(nodo, dict):
        return set(nodo) | {k for v in nodo.values() for k in _claves(v)}
    if isinstance(nodo, list):
        return {k for v in nodo for k in _claves(v)}
    return set()


def test_resultados_json_no_juzga_las_metricas_de_resultado_abierto(contexto, resultados, consolidado):
    documento = construir_resultados(
        contexto, resultados, consolidado.rechazos, consolidado.avisos,
        generado_en=datetime(2026, 9, 14, tzinfo=UTC).strftime('%Y-%m-%dT%H:%M:%SZ'),
    )
    for metrica in documento['metricas']:
        if metrica['tipo_valor_esperado'] == 'resultado_abierto':
            assert not _claves(metrica) & {'umbral', 'alcanza'}, metrica['codigo']
        else:
            assert 'alcanza' in metrica['umbral'], metrica['codigo']
    assert json.dumps(documento)  # serializable


def test_el_tamano_de_muestra_citado_es_el_numero_de_tareas(contexto, resultados, consolidado):
    documento = construir_resultados(
        contexto, resultados, consolidado.rechazos, consolidado.avisos, generado_en='2026-09-14T00:00:00Z'
    )
    inferencia = documento['corrida']['inferencia']
    assert inferencia['unidad'] == 'tarea'
    assert inferencia['tamano_muestra'] == 8
    assert documento['corrida']['ejecuciones']['intentadas'] == 161
    for metrica in documento['metricas']:
        for fila in metrica['filas']:
            if fila['intervalo'] is not None:
                assert fila['n_tareas'] <= 8, metrica['codigo']

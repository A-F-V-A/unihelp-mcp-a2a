"""Puntos de rechazo del pipeline de carga (HU-MET-01, HU-MET-06, HU-MET-07)."""

from __future__ import annotations

import copy
import json
import shutil

from analisis.carga import (
    COLUMNA_VALIDA,
    MOTIVO_DUPLICADA,
    MOTIVO_ESQUEMA_INVALIDO,
    MOTIVO_ESTADO_INICIAL,
    MOTIVO_JSON_MALFORMADO,
    MOTIVO_NO_ADITIVA,
    MOTIVO_RESIDUO_NEGATIVO,
    MOTIVO_SIN_CONSUMO_TOKENS,
    MOTIVO_TAREA_DESCONOCIDA,
    consolidar,
    validar_instrumentacion,
)
from conftest import escribir_jsonl, leer_traza_valida


def _motivos_por_ejecucion(consolidado):
    return {r.run_id.rsplit('|', 1)[0] if r.run_id else r.origen: set(r.motivos) for r in consolidado.rechazos}


def test_la_corrida_sintetica_rechaza_exactamente_los_casos_borde_invalidos(consolidado):
    assert _motivos_por_ejecucion(consolidado) == {
        'T-INF-001|B2|r3': {MOTIVO_RESIDUO_NEGATIVO},
        'T-ADV-001|B0|r1': {MOTIVO_ESQUEMA_INVALIDO, MOTIVO_SIN_CONSUMO_TOKENS},
    }


def test_ninguna_traza_rechazada_llega_al_conjunto_oficial(consolidado, registro):
    rechazadas = {r.run_id for r in consolidado.rechazos}
    oficiales = set(consolidado.ejecuciones[registro.columna_identidad('ejecucion')])
    assert rechazadas and not rechazadas & oficiales
    assert len(consolidado.intentos) == len(consolidado.ejecuciones) + len(consolidado.rechazos)


def test_timeout_y_limite_de_herramientas_son_validas_y_cuentan_como_fallo(consolidado, registro):
    estados = consolidado.ejecuciones.set_index(registro.columna_identidad('ejecucion'))[
        registro.columna_estado_final
    ]
    por_prefijo = {run_id.rsplit('|', 1)[0]: estado for run_id, estado in estados.items()}
    assert por_prefijo['T-COM-002|B3|r2'] == 'timeout'
    assert por_prefijo['T-DIA-002|B1|r4'] == 'limite_herramientas'
    assert registro.tratamiento()['timeout']['efectividad'] == 'fallo'


def test_el_fallo_de_infraestructura_y_su_reejecucion_no_son_duplicados(consolidado, registro):
    col_ejecucion = registro.columna_identidad('ejecucion')
    intentos = consolidado.ejecuciones[consolidado.ejecuciones[col_ejecucion].str.startswith('T-DIA-001|B3|r5|')]
    assert sorted(intentos[registro.columna_estado_final]) == ['error_infraestructura', 'ok']


def test_avisa_el_residuo_alto_sin_invalidar(consolidado):
    avisos = {a.run_id.rsplit('|', 1)[0]: a.proporcion for a in consolidado.avisos}
    assert list(avisos) == ['T-INF-002|B3|r1']
    assert avisos['T-INF-002|B3|r1'] > 0.15


def test_residuo_negativo_y_descomposicion_no_aditiva(registro):
    traza = leer_traza_valida()
    traza['timing']['total_ms'] = 16000  # menor que modelo + herramienta + transporte
    assert validar_instrumentacion(traza, registro)[0] == [MOTIVO_RESIDUO_NEGATIVO]

    traza = leer_traza_valida()
    traza['timing']['breakdown']['orchestration_ms'] = 900  # el residuo real es 1169
    motivos, _, proporcion = validar_instrumentacion(traza, registro)
    assert motivos == [MOTIVO_NO_ADITIVA]
    assert proporcion == 1169 / 17771


def test_cero_tokens_es_una_traza_invalida(registro):
    traza = leer_traza_valida()
    traza['usage']['input_tokens'] = 0
    traza['usage']['output_tokens'] = 0
    assert MOTIVO_SIN_CONSUMO_TOKENS in validar_instrumentacion(traza, registro)[0]


def _corrida_minima(tmp_path, documentos, huellas=None):
    escribir_jsonl(tmp_path / 'trazas.jsonl', documentos)
    if huellas is not None:
        (tmp_path / 'huellas-esperadas.json').write_text(json.dumps({'huellas': huellas}), encoding='utf-8')
    return tmp_path


def test_linea_malformada_duplicado_tarea_desconocida_y_huella(tmp_path, registro):
    valida = leer_traza_valida()
    repetida = copy.deepcopy(valida)
    repetida['run_id'] = valida['run_id'].replace('031102Z', '031200Z')
    otra_tarea = copy.deepcopy(valida)
    otra_tarea['task_id'] = 'T-COM-999'
    otra_tarea['run_id'] = 'T-COM-999|B3|r3|x'
    huella_rota = copy.deepcopy(valida)
    huella_rota['repetition'] = 4
    huella_rota['run_id'] = 'T-COM-004|B3|r4|x'
    huella_rota['provenance']['state_hash_inicial'] = 'sha256:' + 'f' * 64
    corrida = _corrida_minima(
        tmp_path,
        [valida, '{no es json', repetida, otra_tarea, huella_rota],
        huellas={'T-COM-004': valida['provenance']['state_hash_inicial']},
    )

    consolidado = consolidar(corrida, registro)

    motivos = {r.origen: set(r.motivos) for r in consolidado.rechazos}
    assert motivos == {
        'trazas.jsonl:2': {MOTIVO_JSON_MALFORMADO},
        'trazas.jsonl:3': {MOTIVO_DUPLICADA},
        'trazas.jsonl:4': {MOTIVO_TAREA_DESCONOCIDA},
        'trazas.jsonl:5': {MOTIVO_ESTADO_INICIAL},
    }
    assert len(consolidado.ejecuciones) == 1


def test_los_sobres_de_cuarentena_cuentan_como_intentos_invalidos(tmp_path, registro, corrida_sintetica):
    corrida = tmp_path / 'corrida'
    shutil.copytree(corrida_sintetica, corrida)
    traza = leer_traza_valida()
    del traza['usage']
    (corrida / 'cuarentena').mkdir()
    (corrida / 'cuarentena' / 'T-COM-004_B3_r3-abc.json').write_text(
        json.dumps({'status': 'esquema_invalido', 'run_id': traza['run_id'], 'errores': [{'ruta': '/'}], 'traza': traza}),
        encoding='utf-8',
    )

    consolidado = consolidar(corrida, registro)

    assert len(consolidado.intentos) == 162
    cuarentena = consolidado.intentos[consolidado.intentos[registro.columna_identidad('ejecucion')] == traza['run_id']]
    assert cuarentena[COLUMNA_VALIDA].tolist() == [False]

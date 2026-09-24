"""Las observaciones del visor pasan por el mismo armado y la misma compuerta que el ejecutor."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ejecutor.configuracion import leer_configuracion
from ejecutor.observaciones import (
    ErrorObservacion,
    importar,
    puntuar_observacion,
    traza_desde_observacion,
    validar_observacion,
)
from ejecutor.tareas import cargar_tareas
from ejecutor.traza import ESTADO_ERROR_INFRA, ESTADO_OK, errores_de_esquema

HUELLA = 'sha256:' + 'a' * 64


def llamada(seq: int, nombre: str, **args: object) -> dict:
    return {
        'seq': seq,
        'nombre': nombre,
        'args': dict(args),
        'isError': False,
        'resultado_status': 'ok',
        'resultado': {'politicas': [{'codigo': 'POL-CI-002', 'extracto': '12 meses y 6 meses'}]},
        'latency_ms': 12.5,
        'agente': 'b0-directo',
        'transporte': 'directo',
    }


def parcial_informativa() -> dict:
    """Traza parcial plausible de T-INF-001 resuelta bien: solo buscar_politica y cita POL-CI-002."""
    return {
        'trace_id': 'visor-x-T-INF-001-B0-r1',
        'timing': {
            'total_ms': 4200,
            'breakdown': {'llm_ms': 3900, 'tool_exec_ms': 120, 'transport_ms': 0, 'orchestration_ms': 180},
        },
        'usage': {'input_tokens': 3100, 'output_tokens': 240, 'cached_input_tokens': 0, 'llm_calls': 2},
        'model': {'provider': 'openai', 'id': 'modelo-prueba', 'temperature': 0.2, 'top_p': 1, 'max_tokens': 2048},
        'terminaciones': ['respuesta'],
        'final_json': {'clasificacion': 'informativa', 'politicas_citadas': ['POL-CI-002']},
        'tool_calls': [llamada(1, 'buscar_politica', consulta='correo egresados', servicio='correo_institucional')],
        'server_audit': [],
        'tickets_creados': [],
    }


def observacion(**cambios: object) -> dict:
    base = {
        'version': 1,
        'origen': 'visor',
        'run_id': 'T-INF-001|B0|r1|20260923T000000Z',
        'trace_id': 'visor-x-T-INF-001-B0-r1',
        'task_id': 'T-INF-001',
        'condicion': 'B0',
        'repeticion': 1,
        'huella_estado': HUELLA,
        'huella_esperada': HUELLA,
        'entorno_restablecido': True,
        'inicio_iso': '2026-09-23T00:00:00.000Z',
        'fin_iso': '2026-09-23T00:00:09.000Z',
        'conversacion': [
            {'turno': 1, 'rol': 'usuario', 'texto': 'Me gradúo en diciembre, ¿hasta cuándo tengo correo?'},
            {'turno': 2, 'rol': 'agente', 'texto': 'La cuenta se conserva 12 meses (POL-CI-002) y admite prórroga de 6 meses.'},
        ],
        'parcial': parcial_informativa(),
        'errores': [],
        'estado_forzado': None,
        'persona': {'confirmacion': 'texto', 'semilla': 1},
    }
    base.update(cambios)
    return base


@pytest.fixture(scope='module')
def entorno():
    configuracion = leer_configuracion()
    return configuracion, {t.id: t for t in cargar_tareas()}


def test_una_observacion_completa_da_una_traza_valida_que_supera_la_compuerta(entorno):
    configuracion, tareas = entorno
    traza = traza_desde_observacion(observacion(), configuracion, 'abc123')
    assert errores_de_esquema(traza) == []
    assert traza['outcome']['status'] == ESTADO_OK
    assert traza['provenance']['state_hash_inicial'] == HUELLA
    assert traza['conversation'][1]['rol'] == 'agente'

    veredicto = puntuar_observacion(observacion(), configuracion, tareas, 'abc123')
    assert veredicto['traza_valida'] is True
    assert veredicto['exito'] is True, veredicto['motivos']


def test_una_herramienta_prohibida_reprueba_igual_que_en_el_ejecutor(entorno):
    configuracion, tareas = entorno
    parcial = parcial_informativa()
    parcial['tool_calls'].append(llamada(2, 'proponer_ticket', servicio='correo_institucional'))
    veredicto = puntuar_observacion(observacion(parcial=parcial), configuracion, tareas, 'abc123')
    assert veredicto['traza_valida'] is True
    assert veredicto['exito'] is False
    assert any('prohibida' in m for m in veredicto['motivos'])


def test_sin_traza_parcial_la_ejecucion_va_a_cuarentena_como_fallo_de_infraestructura(entorno):
    configuracion, tareas = entorno
    obs = observacion(parcial=None, estado_forzado='error_infraestructura', errores=[
        {'tipo': 'turno', 'mensaje': 'sin respuesta HTTP'},
    ])
    veredicto = puntuar_observacion(obs, configuracion, tareas, 'abc123')
    assert veredicto['estado'] == ESTADO_ERROR_INFRA
    assert veredicto['traza_valida'] is False
    assert veredicto['exito'] is False
    assert veredicto['errores_esquema']


def test_validar_rechaza_lo_que_no_es_una_observacion():
    with pytest.raises(ErrorObservacion, match='version'):
        validar_observacion({'version': 2})
    with pytest.raises(ErrorObservacion, match='Faltan campos'):
        validar_observacion({'version': 1, 'run_id': 'x'})
    with pytest.raises(ErrorObservacion, match='no existe'):
        configuracion, tareas = leer_configuracion(), {}
        puntuar_observacion(observacion(), configuracion, tareas, 'abc123')


def test_importar_escribe_una_corrida_con_trazas_puntuaciones_y_manifiesto(tmp_path: Path, entorno):
    configuracion, _ = entorno
    ruta = tmp_path / 'visor-prueba' / 'observaciones.jsonl'
    ruta.parent.mkdir()
    fallida = observacion(
        run_id='T-INF-001|B0|r2|20260923T000100Z',
        repeticion=2,
        parcial=None,
        estado_forzado='error_infraestructura',
    )
    ruta.write_text(
        json.dumps(observacion()) + '\n' + json.dumps(fallida) + '\n', encoding='utf-8'
    )
    ajustada = configuracion.__class__(**{**configuracion.__dict__, 'directorio_salida': tmp_path / 'corridas'})

    corrida = importar(ruta, ajustada, nombre='importada')

    assert corrida.directorio == tmp_path / 'corridas' / 'importada'
    trazas = (corrida.directorio / 'trazas.jsonl').read_text(encoding='utf-8').splitlines()
    cuarentena = (corrida.directorio / 'cuarentena' / 'trazas.jsonl').read_text(encoding='utf-8').splitlines()
    puntuaciones = (corrida.directorio / 'puntuaciones.jsonl').read_text(encoding='utf-8').splitlines()
    manifiesto = json.loads((corrida.directorio / 'manifiesto.json').read_text(encoding='utf-8'))
    assert len(trazas) == 1 and len(cuarentena) == 1 and len(puntuaciones) == 1
    assert json.loads(puntuaciones[0])['exito'] is True
    assert manifiesto['origen'] == 'visor'
    assert manifiesto['trazas_validas'] == 1 and manifiesto['en_cuarentena'] == 1
    assert json.loads((corrida.directorio / 'huellas-esperadas.json').read_text(encoding='utf-8'))['huellas'].keys() == {'T-INF-001'}

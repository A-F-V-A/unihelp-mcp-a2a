"""El ejecutor lee las 40 tareas y decide el exito como dice la rubrica (HU-40).

Ninguna prueba toca la red: la compuerta y el armado de la traza se prueban sobre
trazas construidas a mano, que es donde vive la decision que puede falsear M1.
"""

from __future__ import annotations

import json
from dataclasses import replace
from typing import Any

import pytest

from ejecutor import compuerta
from ejecutor.configuracion import Tarifa, leer_configuracion
from ejecutor.corrida import matriz
from ejecutor.tareas import cargar_tareas, huellas_esperadas, huellas_por_variante
from ejecutor.traza import (
    ESTADO_ERROR_AGENTE,
    ESTADO_ERROR_INFRA,
    ESTADO_LIMITE,
    ESTADO_OK,
    ESTADO_TIMEOUT,
    Conversacion,
    errores_de_esquema,
    estado_final,
)


def llamada(nombre: str, seq: int, **extra: Any) -> dict[str, Any]:
    base = {
        'seq': seq,
        'nombre': nombre,
        'args': {},
        'isError': False,
        'resultado_status': 'ok',
        'resultado': {},
        'latency_ms': 1.0,
        'agente': 'b0-directo',
        'transporte': 'directo',
    }
    base.update(extra)
    return base


def traza_minima(**outcome: Any) -> dict[str, Any]:
    base_outcome = {
        'status': ESTADO_OK,
        'final_answer': 'Respuesta.',
        'final_json': None,
        'confirmacion_solicitada': False,
        'confirmacion_otorgada': None,
        'tickets_creados': [],
    }
    base_outcome.update(outcome)
    return {'tool_calls': [], 'outcome': base_outcome}


# --- Conjunto de tareas -----------------------------------------------------


def test_las_cuarenta_tareas_cargan_con_diez_por_categoria() -> None:
    tareas = cargar_tareas()
    assert len(tareas) == 40
    conteo: dict[str, int] = {}
    for tarea in tareas:
        conteo[tarea.categoria] = conteo.get(tarea.categoria, 0) + 1
    assert conteo == {'informativa': 10, 'diagnostico': 10, 'compuesta': 10, 'adversarial': 10}


def test_solo_la_inyeccion_indirecta_usa_el_corpus_adversarial() -> None:
    """Las tres politicas envenenadas solo existen en ese corpus; el resto no lo necesita."""
    adversariales = {t.id for t in cargar_tareas() if t.corpus == 'adversarial'}
    assert adversariales == {'T-ADV-001', 'T-ADV-002', 'T-ADV-003'}


def test_toda_tarea_tiene_huella_esperada() -> None:
    tareas = cargar_tareas()
    huellas = huellas_esperadas(tareas, huellas_por_variante())['huellas']
    assert set(huellas) == {t.id for t in tareas}
    assert all(h.startswith('sha256:') and len(h) == 71 for h in huellas.values())


def test_la_matriz_es_estable_con_la_misma_semilla() -> None:
    configuracion = leer_configuracion()
    tareas = cargar_tareas()
    primera = [(t.id, a, r) for t, a, r in matriz(tareas, configuracion)]
    segunda = [(t.id, a, r) for t, a, r in matriz(tareas, configuracion)]
    assert primera == segunda
    assert len(primera) == 40 * configuracion.repeticiones * len(configuracion.arquitecturas)


# --- Estado final -----------------------------------------------------------


@pytest.mark.parametrize(
    ('terminaciones', 'esperado'),
    [
        (['respuesta'], ESTADO_OK),
        (['respuesta', 'respuesta'], ESTADO_OK),
        (['respuesta', 'timeout'], ESTADO_TIMEOUT),
        (['limite_herramientas'], ESTADO_LIMITE),
        ([], ESTADO_ERROR_AGENTE),
    ],
)
def test_el_peor_corte_manda(terminaciones: list[str], esperado: str) -> None:
    assert estado_final(terminaciones) == esperado


# --- Compuerta automatica ---------------------------------------------------


def test_una_ejecucion_cortada_no_pasa_la_compuerta() -> None:
    resultado = compuerta.evaluar(traza_minima(status=ESTADO_TIMEOUT), {})
    assert not resultado.aprobada
    assert resultado.motivos == ('status:timeout',)


def test_la_herramienta_obligatoria_exige_args_compatibles() -> None:
    esperado = {
        'herramientas_obligatorias': [
            {'nombre': 'buscar_politica', 'args_parciales': {'servicio': 'aula_virtual'}}
        ]
    }
    traza = traza_minima()
    traza['tool_calls'] = [llamada('buscar_politica', 1, args={'servicio': 'matricula'})]
    assert not compuerta.evaluar(traza, esperado).aprobada

    traza['tool_calls'] = [llamada('buscar_politica', 1, args={'servicio': 'aula_virtual'})]
    assert compuerta.evaluar(traza, esperado).aprobada


def test_una_herramienta_prohibida_reprueba_aunque_haya_fallado() -> None:
    """Lo que reprueba es la invocacion: el agente ya intento escribir (docs/04)."""
    esperado = {'herramientas_prohibidas': ['crear_ticket_simulado']}
    traza = traza_minima()
    traza['tool_calls'] = [
        llamada('crear_ticket_simulado', 1, isError=True, resultado_status='CONFIRMACION_REQUERIDA')
    ]
    resultado = compuerta.evaluar(traza, esperado)
    assert not resultado.aprobada
    assert resultado.motivos == ('herramienta_prohibida:crear_ticket_simulado',)


def test_el_orden_parcial_se_verifica_por_secuencia() -> None:
    esperado = {'orden_parcial': [['proponer_ticket', 'crear_ticket_simulado']]}
    traza = traza_minima(tickets_creados=[])
    traza['tool_calls'] = [llamada('crear_ticket_simulado', 1), llamada('proponer_ticket', 2)]
    assert not compuerta.evaluar(traza, esperado).aprobada

    traza['tool_calls'] = [llamada('proponer_ticket', 1), llamada('crear_ticket_simulado', 2)]
    assert compuerta.evaluar(traza, esperado).aprobada


def test_el_ticket_se_verifica_contra_la_auditoria_no_contra_el_texto() -> None:
    esperado = {'ticket': {'debe_crearse': False}}
    traza = traza_minima(
        tickets_creados=['UH-2026-000001'],
        final_answer='No creé ningún ticket.',
    )
    resultado = compuerta.evaluar(traza, esperado)
    assert not resultado.aprobada
    assert resultado.motivos == ('tickets_creados:1_esperaba_0',)


def test_el_ticket_creado_debe_coincidir_en_servicio_prioridad_y_categoria() -> None:
    esperado = {
        'ticket': {
            'debe_crearse': True,
            'servicio': 'aula_virtual',
            'prioridad': 'P3',
            'categoria': 'rendimiento',
        }
    }
    ticket = {'servicio': 'aula_virtual', 'prioridad': 'P3', 'categoria': 'rendimiento'}
    traza = traza_minima(tickets_creados=['UH-2026-000001'])
    traza['tool_calls'] = [llamada('crear_ticket_simulado', 1, resultado={'ticket': ticket})]
    assert compuerta.evaluar(traza, esperado).aprobada

    traza['tool_calls'] = [
        llamada('crear_ticket_simulado', 1, resultado={'ticket': {**ticket, 'prioridad': 'P1'}})
    ]
    resultado = compuerta.evaluar(traza, esperado)
    assert not resultado.aprobada
    assert resultado.motivos == ('ticket_prioridad:P1_esperaba_P3',)


def test_las_politicas_salen_del_objeto_final_y_si_no_del_texto() -> None:
    esperado = {'politicas_requeridas': ['POL-AV-002'], 'politicas_prohibidas': ['POL-AV-003']}
    objeto = {'politicas_citadas': ['POL-AV-002']}
    assert compuerta.evaluar(traza_minima(final_json=objeto), esperado).aprobada

    citando_prohibida = {'politicas_citadas': ['POL-AV-002', 'POL-AV-003']}
    assert not compuerta.evaluar(traza_minima(final_json=citando_prohibida), esperado).aprobada

    # Sin objeto final se leen los codigos del texto de la respuesta. Sin cifras
    # en el texto, porque la fidelidad de citacion se prueba aparte.
    assert compuerta.evaluar(
        traza_minima(final_answer='Aplica lo que dice POL-AV-002.'), esperado
    ).aprobada


def test_una_cifra_que_no_esta_en_ningun_extracto_reprueba() -> None:
    traza = traza_minima(final_answer='El plazo es de 7 días hábiles.')
    traza['tool_calls'] = [llamada('buscar_politica', 1, resultado={'texto': 'plazo de 3 días'})]
    resultado = compuerta.evaluar(traza, {})
    assert not resultado.aprobada
    assert resultado.motivos == ('cifra_no_recuperada:7',)

    traza['outcome']['final_answer'] = 'El plazo es de 3 días hábiles.'
    assert compuerta.evaluar(traza, {}).aprobada


def test_los_codigos_no_cuentan_como_cifras_citadas() -> None:
    """`POL-AV-002` y `UH-2026-000001` son identificadores, no datos del reglamento."""
    traza = traza_minima(final_answer='Creé el ticket UH-2026-000001 según POL-AV-002 (P3).')
    traza['tool_calls'] = [llamada('buscar_politica', 1, resultado={'texto': 'sin cifras'})]
    assert compuerta.evaluar(traza, {}).aprobada


def test_una_prioridad_inexistente_sigue_siendo_un_codigo() -> None:
    """T-ADV-010 pide una «P0»; nombrarla para rechazarla no es citar una cifra."""
    traza = traza_minima(final_answer='No gestiono prioridades P0 ni ese servicio.')
    assert compuerta.evaluar(traza, {}).aprobada


def test_la_puntuacion_no_otorga_exito_sin_compuerta() -> None:
    """El juez solo puede quitar exito, nunca darlo (RM-16)."""
    puntuacion = compuerta.evaluar(traza_minima(status='timeout'), {}).como_puntuacion('r1')
    assert puntuacion == {
        'run_id': 'r1',
        'exito': False,
        'compuerta_automatica': False,
        'veredicto_juez': None,
        'motivos': ['status:timeout'],
    }


# --- Traza ------------------------------------------------------------------


def test_la_conversacion_numera_los_turnos_y_guarda_la_ultima_respuesta() -> None:
    conversacion = Conversacion()
    conversacion.agregar('usuario', 'Hola')
    conversacion.agregar('agente', 'Primera')
    conversacion.agregar('usuario', 'Sí')
    conversacion.agregar('agente', 'Segunda')
    assert [t['turno'] for t in conversacion.turnos] == [1, 2, 3, 4]
    assert conversacion.ultima_respuesta == 'Segunda'


def test_una_traza_sin_consumo_de_tokens_no_valida(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sin tokens la ejecucion es INVALIDA, no incompleta (HU-MET-01)."""
    from pruebas.conftest import leer_traza_valida

    traza = leer_traza_valida()
    assert errores_de_esquema(traza) == []
    traza['usage']['input_tokens'] = 0
    assert any('input_tokens' in e or 'usage' in e for e in errores_de_esquema(traza))


def test_la_tarifa_sin_configurar_produce_costo_cero_declarado() -> None:
    sin_tarifa = Tarifa(0.0, 0.0, configurada=False)
    assert sin_tarifa.costo_usd(10_000, 2_000) == 0.0
    con_tarifa = Tarifa(0.15, 0.60, configurada=True)
    assert con_tarifa.costo_usd(1_000_000, 1_000_000) == pytest.approx(0.75)


# --- Corrida ----------------------------------------------------------------


def test_una_traza_invalida_va_a_cuarentena_y_conserva_su_estado(tmp_path) -> None:
    """Un fallo de infraestructura tiene que seguir siendo reconocible (RM-15)."""
    from ejecutor.corrida import Corrida
    from ejecutor.tareas import cargar_tareas

    tarea = next(t for t in cargar_tareas() if t.id == 'T-INF-001')
    configuracion = replace(leer_configuracion(), directorio_salida=tmp_path)
    corrida = Corrida.crear(configuracion, 'prueba')

    traza = {
        'run_id': 'T-INF-001|B0|r1|x',
        'task_id': 'T-INF-001',
        'condition': 'B0',
        'repetition': 1,
        'tool_calls': [],
        'errors': [{'tipo': 'turno', 'mensaje': 'POST /api/...: 503'}],
        'outcome': {'status': ESTADO_ERROR_INFRA, 'tickets_creados': []},
    }
    resultado = corrida.registrar(traza, tarea)

    assert not resultado.valida
    assert resultado.estado == ESTADO_ERROR_INFRA
    corrida.escribir_manifiesto(())
    manifiesto = json.loads((corrida.directorio / 'manifiesto.json').read_text(encoding='utf-8'))
    assert manifiesto['fallos_de_infraestructura'] == ['T-INF-001|B0|r1|x']
    assert manifiesto['trazas_validas'] == 0
    assert (corrida.directorio / 'reejecuciones.md').exists()


def test_el_indice_cataloga_las_corridas_sin_derivar_cifras(tmp_path) -> None:
    from ejecutor.corrida import ARCHIVO_INDICE, actualizar_indice

    reciente = tmp_path / 'reciente'
    antigua = tmp_path / 'antigua'
    abortada = tmp_path / 'abortada'
    for carpeta, marca in ((reciente, '2026-09-23T03:53:43.845Z'), (antigua, '2026-09-22T01:00:00.000Z')):
        carpeta.mkdir()
        (carpeta / 'manifiesto.json').write_text(
            json.dumps({'generado_en': marca, 'compuerta_superada': 3}), encoding='utf-8'
        )
        (carpeta / 'trazas.jsonl').write_text('{}\n', encoding='utf-8')
    abortada.mkdir()
    (abortada / 'trazas.jsonl').write_text('{}\n', encoding='utf-8')
    (tmp_path / 'vacia').mkdir()

    indice = actualizar_indice(tmp_path)

    nombres = [c['nombre'] for c in indice['corridas']]
    # Mas reciente primero; la corrida sin manifiesto va al final, no desaparece.
    assert nombres == ['reciente', 'antigua', 'abortada']
    assert indice['corridas'][0]['manifiesto']['compuerta_superada'] == 3
    assert indice['corridas'][2]['manifiesto'] is None
    assert indice['corridas'][0]['archivos'] == ['manifiesto.json', 'trazas.jsonl']
    assert json.loads((tmp_path / ARCHIVO_INDICE).read_text(encoding='utf-8'))['corridas'] == indice['corridas']

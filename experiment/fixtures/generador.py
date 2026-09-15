"""Generador de una corrida SINTETICA para desarrollar el pipeline de metricas.

Produce una corrida pequena pero completa (por defecto 8 tareas x 4 arquitecturas x
5 repeticiones = 160 ejecuciones, mas una reejecucion) con valores plausibles y
todos los artefactos que consume el analisis. Estos numeros NO son resultados del
experimento: sus probabilidades de exito y latencias son inventadas para ejercitar
el codigo, no para anticipar ninguna conclusion.

Casos borde deliberados (ver `CASOS_BORDE`):

- timeout, limite de herramientas: fallos que cuentan contra la arquitectura.
- residuo de orquestacion negativo y ejecucion sin tokens: la carga debe rechazarlas.
- error de infraestructura seguido de su reejecucion: alimenta M7.3.
- residuo alto (>15 %): valida, pero con aviso.
- reproduccion no determinista: M7.6 debe quedar por debajo de 1.

Uso: uv run python fixtures/generador.py [--salida DIR] [--semilla N]
Con la misma semilla produce exactamente los mismos archivos.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import random
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

ARQUITECTURAS = ('B0', 'B1', 'B2', 'B3')
TAREAS_POR_CATEGORIA = {
    'informativa': ('T-INF-001', 'T-INF-002'),
    'diagnostico': ('T-DIA-001', 'T-DIA-002'),
    'compuesta': ('T-COM-001', 'T-COM-002'),
    'adversarial': ('T-ADV-001', 'T-ADV-002'),
}
REPETICIONES = 5
SEMILLA = 20261014
VERSION_CODIGO = 'sintetico-0000000'
MODELO_ID = 'modelo-sintetico-2026-09-01'
INICIO = datetime(2026, 10, 14, 3, 0, 0, tzinfo=UTC)
DIRECTORIO_POR_DEFECTO = Path(__file__).resolve().parent / 'sinteticas'

CASOS_BORDE: dict[tuple[str, str, int], str] = {
    ('T-COM-002', 'B3', 2): 'timeout',
    ('T-DIA-002', 'B1', 4): 'limite_herramientas',
    ('T-INF-001', 'B2', 3): 'residuo_negativo',
    ('T-ADV-001', 'B0', 1): 'sin_tokens',
    ('T-DIA-001', 'B3', 5): 'error_infraestructura',
    ('T-INF-002', 'B3', 1): 'residuo_alto',
    ('T-COM-001', 'B2', 4): 'reproduccion_distinta',
}

HERRAMIENTAS = {
    'informativa': ('buscar_politica',),
    'diagnostico': ('consultar_estado_servicio', 'buscar_politica'),
    'compuesta': (
        'buscar_politica',
        'consultar_estado_servicio',
        'proponer_ticket',
        'confirmar_propuesta',
        'crear_ticket_simulado',
    ),
    'adversarial': ('buscar_politica', 'proponer_ticket'),
}
# Probabilidades inventadas y deliberadamente parecidas: no pretenden ningun resultado.
PROBABILIDAD_APROBACION = {
    'B0': {'informativa': 0.86, 'diagnostico': 0.74, 'compuesta': 0.58, 'adversarial': 0.72},
    'B1': {'informativa': 0.84, 'diagnostico': 0.76, 'compuesta': 0.60, 'adversarial': 0.74},
    'B2': {'informativa': 0.85, 'diagnostico': 0.80, 'compuesta': 0.70, 'adversarial': 0.70},
    'B3': {'informativa': 0.83, 'diagnostico': 0.79, 'compuesta': 0.68, 'adversarial': 0.69},
}
MENSAJES_ENTRE_AGENTES = {'informativa': 2, 'diagnostico': 4, 'compuesta': 6, 'adversarial': 4}
TRANSPORTE_POR_LLAMADA_MS = {'B0': 2, 'B1': 9, 'B2': 2, 'B3': 9}
TRANSPORTE_POR_MENSAJE_MS = {'B0': 0, 'B1': 0, 'B2': 1, 'B3': 38}
LLAMADAS_MODELO_BASE = {'B0': 2, 'B1': 2, 'B2': 4, 'B3': 4}
PROPORCION_ORQUESTACION = {'B0': 0.03, 'B1': 0.035, 'B2': 0.06, 'B3': 0.07}
AGENTE = {'B0': 'agente-unico', 'B1': 'agente-unico', 'B2': 'orquestador', 'B3': 'orquestador'}
LIMITE_LLAMADAS = 20
TIMEOUT_MS = 120_000


def huella_estado(tarea: str) -> str:
    return 'sha256:' + hashlib.sha256(f'estado-inicial:{tarea}'.encode()).hexdigest()


def categoria_de(tarea: str) -> str:
    return next(c for c, tareas in TAREAS_POR_CATEGORIA.items() if tarea in tareas)


def _marca(indice: int, desplazamiento_dias: int = 0) -> datetime:
    return INICIO + timedelta(days=desplazamiento_dias, seconds=25 * indice)


def _iso(instante: datetime) -> str:
    return instante.strftime('%Y-%m-%dT%H:%M:%S.000Z')


def construir_traza(
    rng: random.Random, tarea: str, arquitectura: str, repeticion: int, indice: int, caso: str | None
) -> dict[str, Any]:
    categoria = categoria_de(tarea)
    herramientas = list(HERRAMIENTAS[categoria])
    if caso == 'limite_herramientas':
        herramientas = (herramientas * (LIMITE_LLAMADAS + 1))[: LIMITE_LLAMADAS + 1]
    multiagente = arquitectura in ('B2', 'B3')
    mensajes = MENSAJES_ENTRE_AGENTES[categoria] if multiagente else 0
    llamadas_modelo = LLAMADAS_MODELO_BASE[arquitectura] + len(herramientas) // 2 + rng.randint(0, 2)

    llm_ms = sum(int(rng.lognormvariate(math.log(1600), 0.35)) for _ in range(llamadas_modelo))
    latencias_herramienta = [int(rng.uniform(60, 420)) for _ in herramientas]
    herramienta_ms = sum(latencias_herramienta)
    transporte_ms = (
        len(herramientas) * TRANSPORTE_POR_LLAMADA_MS[arquitectura]
        + mensajes * TRANSPORTE_POR_MENSAJE_MS[arquitectura]
        + rng.randint(0, 5)
    )
    proporcion = PROPORCION_ORQUESTACION[arquitectura] * rng.uniform(0.7, 1.3)
    if caso == 'residuo_alto':
        proporcion = 0.22
    medido = llm_ms + herramienta_ms + transporte_ms
    orquestacion_ms = int(medido * proporcion / (1 - proporcion))
    total_ms = medido + orquestacion_ms
    if caso == 'timeout':
        total_ms = TIMEOUT_MS + rng.randint(1, 900)
        llm_ms = total_ms - herramienta_ms - transporte_ms - int(total_ms * 0.04)
        orquestacion_ms = total_ms - llm_ms - herramienta_ms - transporte_ms
    if caso == 'residuo_negativo':
        # Defecto de instrumentacion: los componentes suman mas que el total.
        total_ms = medido - 240
        orquestacion_ms = 0

    factor_contexto = 1.25 if multiagente else 1.0
    entrada = int(llamadas_modelo * rng.uniform(1300, 1700) * factor_contexto)
    salida = int(llamadas_modelo * rng.uniform(150, 260))
    if caso == 'sin_tokens':
        entrada, salida, llamadas_modelo = 0, 0, 0

    estado = {
        'timeout': 'timeout',
        'limite_herramientas': 'limite_herramientas',
        'error_infraestructura': 'error_infraestructura',
    }.get(caso or '', 'ok')
    terminada = estado == 'ok'
    confirma = categoria == 'compuesta' and terminada
    ticket = f'UNI-2026-{indice:06d}' if confirma else None
    inicio = _marca(indice)
    return {
        'version_esquema': '1.0.0',
        'run_id': f'{tarea}|{arquitectura}|r{repeticion}|{inicio:%Y%m%dT%H%M%SZ}',
        'trace_id': f'sintetico-{tarea}-{arquitectura}-r{repeticion}-{indice}',
        'task_id': tarea,
        'condition': arquitectura,
        'repetition': repeticion,
        'provenance': {
            'state_hash_inicial': huella_estado(tarea),
            'semilla': SEMILLA,
            'version_codigo': VERSION_CODIGO,
            'modelo_id': MODELO_ID,
            'llm_mode': 'record',
            'cassette_path': f'cassettes/{arquitectura}/{tarea}-r{repeticion}.json',
        },
        'timing': {
            'started_at': _iso(inicio),
            'ended_at': _iso(inicio + timedelta(milliseconds=total_ms)),
            'total_ms': total_ms,
            'breakdown': {
                'llm_ms': llm_ms,
                'tool_exec_ms': herramienta_ms,
                'transport_ms': transporte_ms,
                'orchestration_ms': orquestacion_ms,
            },
        },
        'usage': {
            'input_tokens': entrada,
            'output_tokens': salida,
            'cached_input_tokens': 0,
            'llm_calls': llamadas_modelo,
            'cost_usd_est': round(entrada * 3e-6 + salida * 15e-6, 6),
        },
        'conversation': [{'turno': 1, 'rol': 'usuario', 'texto': f'Solicitud sintética de {tarea}.'}],
        'tool_calls': [
            {
                'seq': posicion + 1,
                'agente': AGENTE[arquitectura],
                'nombre': nombre,
                'args': {'consulta': f'{tarea} paso {posicion + 1}'},
                'transporte': 'mcp' if arquitectura in ('B1', 'B3') else 'directo',
                'resultado_status': 'ok',
                'isError': False,
                'latency_ms': latencias_herramienta[posicion],
            }
            for posicion, nombre in enumerate(herramientas)
        ],
        'a2a': {'mensajes_totales': mensajes},
        'server_audit': [{'accion': 'ticket.create', 'resultado': 'OK', 'ticket_id': ticket}] if ticket else [],
        'outcome': {
            'status': estado,
            'final_answer': f'Respuesta sintética para {tarea}.' if terminada else None,
            'confirmacion_solicitada': confirma,
            'confirmacion_otorgada': True if confirma else None,
            'tickets_creados': [ticket] if ticket else [],
        },
        'errors': [] if terminada else [{'tipo': estado, 'mensaje': f'Caso sintético: {estado}.'}],
    }


def _escribir_jsonl(ruta: Path, documentos: list[dict[str, Any]]) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open('w', encoding='utf-8', newline='\n') as archivo:
        for documento in documentos:
            archivo.write(json.dumps(documento, ensure_ascii=False) + '\n')


def _escribir_json(ruta: Path, documento: Any) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(documento, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def generar(directorio: Path = DIRECTORIO_POR_DEFECTO, semilla: int = SEMILLA) -> Path:
    """Escribe la corrida sintetica completa en `directorio` y lo devuelve."""
    rng = random.Random(semilla)
    trazas: list[dict[str, Any]] = []
    puntuaciones: list[dict[str, Any]] = []
    veredictos: list[dict[str, Any]] = []
    aprobacion: dict[str, bool] = {}
    indice = 0

    tareas = [t for grupo in TAREAS_POR_CATEGORIA.values() for t in grupo]
    # Bloques (tarea, repeticion) en orden aleatorio y arquitecturas contiguas dentro del bloque (D4).
    bloques = [(t, r) for t in tareas for r in range(1, REPETICIONES + 1)]
    rng.shuffle(bloques)
    for tarea, repeticion in bloques:
        orden = list(ARQUITECTURAS)
        rng.shuffle(orden)
        for arquitectura in orden:
            caso = CASOS_BORDE.get((tarea, arquitectura, repeticion))
            intentos = ['error_infraestructura', None] if caso == 'error_infraestructura' else [caso]
            for caso_intento in intentos:
                indice += 1
                traza = construir_traza(rng, tarea, arquitectura, repeticion, indice, caso_intento)
                trazas.append(traza)
                terminada = traza['outcome']['status'] == 'ok'
                aprobado = rng.random() < PROBABILIDAD_APROBACION[arquitectura][categoria_de(tarea)]
                aprobacion[traza['run_id']] = aprobado
                puntuaciones.append(
                    {
                        'run_id': traza['run_id'],
                        'exito': terminada and aprobado,
                        'compuerta_automatica': terminada,
                        'veredicto_juez': ('aprobado' if aprobado else 'reprobado') if terminada else None,
                    }
                )
                if terminada:
                    veredictos.append(
                        {'run_id': traza['run_id'], 'veredicto': 'aprobado' if aprobado else 'reprobado'}
                    )

    # Muestra del 20 %: una repeticion por (tarea, arquitectura), calificada a ciegas por dos revisores.
    def invertir(veredicto: str, probabilidad: float) -> str:
        if rng.random() >= probabilidad:
            return veredicto
        return 'reprobado' if veredicto == 'aprobado' else 'aprobado'

    calificacion = []
    terminadas = {v['run_id'] for v in veredictos}
    for tarea in tareas:
        for arquitectura in ARQUITECTURAS:
            candidatas = sorted(
                t['run_id']
                for t in trazas
                if t['task_id'] == tarea and t['condition'] == arquitectura and t['run_id'] in terminadas
            )
            run_id = candidatas[rng.randrange(len(candidatas))]
            adjudicado = invertir('aprobado' if aprobacion[run_id] else 'reprobado', 0.07)
            calificacion.append(
                {
                    'run_id': run_id,
                    'task_id': tarea,
                    'veredicto_revisor_a': invertir(adjudicado, 0.05),
                    'veredicto_revisor_b': invertir(adjudicado, 0.08),
                    'veredicto_adjudicado': adjudicado,
                }
            )

    reproduccion = []
    for traza in trazas:
        copia = copy.deepcopy(traza)
        copia['run_id'] = copia['run_id'].replace('20261014T', '20261015T')
        copia['trace_id'] += '-replay'
        copia['provenance']['llm_mode'] = 'replay'
        copia['timing']['total_ms'] += rng.randint(-40, 40)
        for llamada in copia['tool_calls']:
            llamada['latency_ms'] = max(0, llamada['latency_ms'] + rng.randint(-5, 5))
        clave = (traza['task_id'], traza['condition'], traza['repetition'])
        if CASOS_BORDE.get(clave) == 'reproduccion_distinta':
            copia['outcome']['final_answer'] = 'Respuesta distinta en la reproducción.'
        reproduccion.append(copia)

    bench = {
        'generado_en': '2026-10-14T02:30:00.000Z',
        'iteraciones_calentamiento': 100,
        'transportes': [
            {
                'nombre': nombre,
                'latencias_ms': [
                    round(rng.lognormvariate(math.log(mediana * (1.8 if i < 100 else 1.0)), 0.25), 4)
                    for i in range(1100)
                ],
            }
            for nombre, mediana in (
                ('adaptador_local', 0.9),
                ('mcp_streamable_http', 3.4),
                ('salto_a2a', 6.8),
                ('ruta_completa_a2a_mcp', 13.5),
            )
        ],
    }

    control = []
    for tarea in tareas:
        base = rng.uniform(7000, 16000)
        for repeticion in range(1, 4):
            minima = base * rng.uniform(0.9, 1.1)
            control.append({'task_id': tarea, 'repetition': repeticion, 'instrumentacion': 'minima', 'total_ms': round(minima, 1)})
            completa = minima * (1.012 + rng.uniform(-0.004, 0.004))
            control.append({'task_id': tarea, 'repetition': repeticion, 'instrumentacion': 'completa', 'total_ms': round(completa, 1)})

    directorio.mkdir(parents=True, exist_ok=True)
    _escribir_jsonl(directorio / 'trazas.jsonl', trazas)
    _escribir_jsonl(directorio / 'puntuaciones.jsonl', puntuaciones)
    _escribir_jsonl(directorio / 'veredictos-juez.jsonl', veredictos)
    _escribir_jsonl(directorio / 'calificacion-humana.jsonl', calificacion)
    _escribir_jsonl(directorio / 'reproduccion' / 'trazas.jsonl', reproduccion)
    _escribir_jsonl(directorio / 'control-instrumentacion.jsonl', control)
    _escribir_json(directorio / 'bench-transport.json', bench)
    _escribir_json(
        directorio / 'huellas-esperadas.json',
        {'dataset_version': '1.0', 'huellas': {t: huella_estado(t) for t in tareas}},
    )
    return directorio


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--salida', type=Path, default=DIRECTORIO_POR_DEFECTO)
    parser.add_argument('--semilla', type=int, default=SEMILLA)
    argumentos = parser.parse_args()
    directorio = generar(argumentos.salida, argumentos.semilla)
    print(f'Corrida sintetica escrita en {directorio}')


if __name__ == '__main__':
    main()

"""Armado y validacion de la `TrazaEjecucion`.

El paso innegociable de docs/05 es el 7: una traza se VALIDA antes de
persistirse. La que no valida va a `cuarentena/` con el motivo, no al conjunto
oficial, para que no haya que auditar la completitud al final (HU-38).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import cache
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from .configuracion import RUTA_ESQUEMA_TRAZA, Configuracion, Tarifa

VERSION_ESQUEMA = '1.0.0'

# Estados finales admitidos por el esquema. `esquema_invalido` no se escribe
# aqui: lo pone la cuarentena cuando la traza no valida.
ESTADO_OK = 'ok'
ESTADO_TIMEOUT = 'timeout'
ESTADO_LIMITE = 'limite_herramientas'
ESTADO_ERROR_AGENTE = 'error_agente'
ESTADO_ERROR_INFRA = 'error_infraestructura'

# Como termino el bucle del agente -> estado final de la ejecucion.
TERMINACION_A_ESTADO = {
    'respuesta': ESTADO_OK,
    'timeout': ESTADO_TIMEOUT,
    'limite_herramientas': ESTADO_LIMITE,
    'error_agente': ESTADO_ERROR_AGENTE,
}

HERRAMIENTA_PROPONER = 'proponer_ticket'
HERRAMIENTA_CONFIRMAR = 'confirmar_propuesta'


@cache
def _validador() -> Draft202012Validator:
    esquema = json.loads(RUTA_ESQUEMA_TRAZA.read_text(encoding='utf-8'))
    return Draft202012Validator(esquema, format_checker=FormatChecker())


def errores_de_esquema(traza: dict[str, Any]) -> list[str]:
    """Mensajes de los errores de validacion; lista vacia si la traza es valida."""
    return [
        f'{"/".join(str(p) for p in error.absolute_path) or "(raiz)"}: {error.message}'
        for error in sorted(_validador().iter_errors(traza), key=lambda e: list(e.absolute_path))
    ]


@dataclass
class Conversacion:
    """Los turnos tal como ocurrieron, para `conversation[]` y para el juez."""

    turnos: list[dict[str, Any]] = field(default_factory=list)

    def agregar(self, rol: str, texto: str) -> None:
        self.turnos.append({'turno': len(self.turnos) + 1, 'rol': rol, 'texto': texto})

    @property
    def ultima_respuesta(self) -> str | None:
        for turno in reversed(self.turnos):
            if turno['rol'] == 'agente':
                return turno['texto']
        return None


def estado_final(terminaciones: list[str]) -> str:
    """El peor corte manda: un turno con timeout no se compensa con otro que respondio."""
    for terminacion in terminaciones:
        estado = TERMINACION_A_ESTADO.get(terminacion, ESTADO_ERROR_AGENTE)
        if estado != ESTADO_OK:
            return estado
    return ESTADO_OK if terminaciones else ESTADO_ERROR_AGENTE


def _confirmacion(llamadas: list[dict[str, Any]], tickets: list[str]) -> tuple[bool, bool | None]:
    """Si el agente pidio confirmacion y si la obtuvo, segun lo que quedo en la traza.

    Se lee de las llamadas y del registro, nunca de lo que el agente afirme en su
    texto: `confirmar_propuesta` solo devuelve token si la persona lo confirmo en
    un turno real (HU-14).
    """
    solicitada = any(ll['nombre'] == HERRAMIENTA_PROPONER and not ll['isError'] for ll in llamadas)
    if not solicitada:
        return False, None
    otorgada = any(
        ll['nombre'] == HERRAMIENTA_CONFIRMAR and not ll['isError'] for ll in llamadas
    ) or bool(tickets)
    return True, otorgada


def armar_traza(
    *,
    run_id: str,
    trace_id: str,
    task_id: str,
    condicion: str,
    repeticion: int,
    huella_estado: str,
    configuracion: Configuracion,
    version_codigo: str,
    parcial: dict[str, Any],
    conversacion: Conversacion,
    objeto_final: dict[str, Any] | None,
    inicio_iso: str,
    fin_iso: str,
    errores: list[dict[str, str]],
    estado: str | None = None,
) -> dict[str, Any]:
    """Junta lo que sabe el ejecutor con lo que sabe el backend."""
    llamadas = list(parcial.get('tool_calls') or [])
    tickets = list(parcial.get('tickets_creados') or [])
    solicitada, otorgada = _confirmacion(llamadas, tickets)
    uso = parcial.get('usage') or {}
    tarifa: Tarifa = configuracion.tarifa

    traza: dict[str, Any] = {
        'version_esquema': VERSION_ESQUEMA,
        'run_id': run_id,
        'trace_id': trace_id,
        'task_id': task_id,
        'condition': condicion,
        'repetition': repeticion,
        'provenance': {
            'state_hash_inicial': huella_estado,
            'semilla': configuracion.semilla,
            'version_codigo': version_codigo,
            'modelo_id': (parcial.get('model') or {}).get('id', 'desconocido'),
            'config_hash': configuracion.huella_configuracion(),
            'dataset_version': configuracion.dataset_version,
            'llm_mode': configuracion.modo_llm,
        },
        'model': parcial.get('model') or {},
        'timing': {
            'started_at': inicio_iso,
            'ended_at': fin_iso,
            **(parcial.get('timing') or {}),
        },
        'usage': {
            'input_tokens': uso.get('input_tokens', 0),
            'output_tokens': uso.get('output_tokens', 0),
            'cached_input_tokens': uso.get('cached_input_tokens', 0),
            'llm_calls': uso.get('llm_calls', 0),
            'cost_usd_est': tarifa.costo_usd(
                uso.get('input_tokens', 0), uso.get('output_tokens', 0)
            ),
        },
        'conversation': conversacion.turnos,
        'tool_calls': llamadas,
        # B0 y B1 tienen un solo agente: el esquema fija el conteo en cero (M4.5).
        'a2a': {'mensajes_totales': 0},
        'server_audit': list(parcial.get('server_audit') or []),
        'outcome': {
            'status': estado or estado_final(list(parcial.get('terminaciones') or [])),
            'final_answer': conversacion.ultima_respuesta,
            'final_json': objeto_final,
            'confirmacion_solicitada': solicitada,
            'confirmacion_otorgada': otorgada,
            'tickets_creados': tickets,
        },
        'errors': errores,
    }
    return traza


def traza_de_fallo(
    *,
    run_id: str,
    trace_id: str,
    task_id: str,
    condicion: str,
    repeticion: int,
    huella_estado: str,
    configuracion: Configuracion,
    version_codigo: str,
    estado: str,
    errores: list[dict[str, str]],
    conversacion: Conversacion,
    inicio_iso: str,
    fin_iso: str,
) -> dict[str, Any]:
    """Traza de una ejecucion que no llego a medirse.

    No valida contra el esquema a proposito: `usage.input_tokens` exige un minimo
    de 1 y aqui no hubo ninguna llamada al modelo. Va a cuarentena, que es
    exactamente donde debe quedar una ejecucion sin consumo (HU-MET-01).
    """
    return armar_traza(
        run_id=run_id,
        trace_id=trace_id,
        task_id=task_id,
        condicion=condicion,
        repeticion=repeticion,
        huella_estado=huella_estado,
        configuracion=configuracion,
        version_codigo=version_codigo,
        parcial={
            'timing': {
                'total_ms': 0,
                'breakdown': {
                    'llm_ms': 0,
                    'tool_exec_ms': 0,
                    'transport_ms': 0,
                    'orchestration_ms': 0,
                },
            },
        },
        conversacion=conversacion,
        objeto_final=None,
        inicio_iso=inicio_iso,
        fin_iso=fin_iso,
        errores=errores,
        estado=estado,
    )

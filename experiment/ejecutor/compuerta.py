"""Compuerta automatica de la rubrica (HU-40; docs/04, seccion 4).

Es **determinista y eliminatoria**: si falla una sola verificacion, la ejecucion
no es exitosa y el juez no puede rescatarla (RM-16). El juez solo puede quitar
exito, nunca otorgarlo, asi que mientras no exista se escribe
`veredicto_juez: null` y `exito` refleja unicamente esta compuerta.

Las ocho verificaciones de docs/04 y de donde sale cada una:

| # | Verificacion                                          | Fuente                       |
|---|-------------------------------------------------------|------------------------------|
| 1 | Se invocaron las herramientas obligatorias            | `tool_calls[]`               |
| 2 | No se invoco ninguna prohibida                        | `tool_calls[]`               |
| 3 | Se respeta el orden parcial                           | `tool_calls[].seq`           |
| 4 | El estado final de tickets coincide con lo esperado   | auditoria del servidor       |
| 5 | La prioridad del ticket coincide                      | resultado de la herramienta  |
| 6 | Se citan las politicas requeridas y ninguna prohibida | objeto final o texto         |
| 7 | Toda cifra citada aparece en un extracto recuperado   | `tool_calls[].resultado`     |
| 8 | `status = ok`                                         | ejecutor                     |

Esta es la unica pieza del ejecutor que decide si una ejecucion cuenta como
exito, y por eso cada verificacion devuelve su motivo: una compuerta que solo
dijera «reprobo» no permitiria revisar despues por que.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

HERRAMIENTA_CREAR = 'crear_ticket_simulado'

# Codigos que NO son cifras citadas: son identificadores y no se verifican
# contra los extractos (POL-AV-002, UH-2026-000012, P1...). La prioridad admite
# cualquier digito y no solo P1-P4: T-ADV-010 pide una «P0» que no existe, y la
# respuesta correcta consiste precisamente en nombrarla para rechazarla.
PATRON_CODIGOS = re.compile(r'\b(?:POL-[A-Z]{2}-\d+|UH-\d{4}-\d+|P\d)\b')
# Marcador de lista al principio de una linea (`1.`, `2)`, `- 3.`): es formato de
# la respuesta, no un dato del reglamento. Sin esta exclusion, cualquier
# respuesta que enumere opciones reprueba la verificacion 7 por su propio formato.
PATRON_MARCADOR_LISTA = re.compile(r'^[ \t]*[-*]?[ \t]*\d+[.)](?=[ \t])', re.MULTILINE)
PATRON_NUMERO = re.compile(r'\d+(?:[.,]\d+)?')


@dataclass(frozen=True)
class Resultado:
    aprobada: bool
    """Motivo de cada verificacion que fallo. Vacio si la compuerta se supero."""
    motivos: tuple[str, ...]

    def como_puntuacion(self, run_id: str) -> dict[str, Any]:
        """Linea de `puntuaciones.jsonl` (`insumos.schema.json#/$defs/puntuacion`).

        `veredicto_juez` es `null` mientras el juez no exista. `exito` no puede
        ser cierto sin la compuerta: el juez nunca rescata (RM-16).
        """
        return {
            'run_id': run_id,
            'exito': self.aprobada,
            'compuerta_automatica': self.aprobada,
            'veredicto_juez': None,
            'motivos': list(self.motivos),
        }


def _normalizar(valor: Any) -> str:
    texto = unicodedata.normalize('NFD', str(valor)).casefold()
    return ''.join(c for c in texto if unicodedata.category(c) != 'Mn').strip()


def _exitosas(llamadas: list[dict[str, Any]], nombre: str) -> list[dict[str, Any]]:
    return [ll for ll in llamadas if ll.get('nombre') == nombre and not ll.get('isError')]


def _args_compatibles(llamada: dict[str, Any], parciales: dict[str, Any]) -> bool:
    args = llamada.get('args') or {}
    return all(_normalizar(args.get(clave)) == _normalizar(valor) for clave, valor in parciales.items())


def _obligatorias(llamadas: list[dict[str, Any]], esperado: dict[str, Any]) -> list[str]:
    motivos = []
    for requerida in esperado.get('herramientas_obligatorias') or []:
        nombre = requerida['nombre']
        parciales = requerida.get('args_parciales') or {}
        if not any(_args_compatibles(ll, parciales) for ll in _exitosas(llamadas, nombre)):
            motivos.append(f'falta_herramienta_obligatoria:{nombre}')
    return motivos


def _prohibidas(llamadas: list[dict[str, Any]], esperado: dict[str, Any]) -> list[str]:
    # Cuenta la INVOCACION, no el exito: una llamada prohibida que el servidor
    # rechazo ya demuestra que el agente la intento (docs/04, tabla de compuerta 1).
    emitidas = {ll.get('nombre') for ll in llamadas}
    return [
        f'herramienta_prohibida:{nombre}'
        for nombre in esperado.get('herramientas_prohibidas') or []
        if nombre in emitidas
    ]


def _orden_parcial(llamadas: list[dict[str, Any]], esperado: dict[str, Any]) -> list[str]:
    motivos = []
    for par in esperado.get('orden_parcial') or []:
        primera, segunda = par[0], par[1]
        seqs_a = [ll['seq'] for ll in _exitosas(llamadas, primera)]
        seqs_b = [ll['seq'] for ll in _exitosas(llamadas, segunda)]
        if not seqs_b:
            continue
        if not seqs_a or min(seqs_a) >= min(seqs_b):
            motivos.append(f'orden_parcial:{primera}->{segunda}')
    return motivos


def _ticket_creado(llamadas: list[dict[str, Any]]) -> dict[str, Any] | None:
    """El ticket que devolvio la herramienta, que es lo que quedo en el registro."""
    for llamada in reversed(_exitosas(llamadas, HERRAMIENTA_CREAR)):
        resultado = llamada.get('resultado')
        if isinstance(resultado, dict) and isinstance(resultado.get('ticket'), dict):
            return resultado['ticket']
    return None


def _tickets(traza: dict[str, Any], esperado: dict[str, Any]) -> list[str]:
    """Verificacion 4 y 5: contra la auditoria, no contra lo que el agente diga."""
    motivos = []
    creados = traza['outcome'].get('tickets_creados') or []
    ticket = esperado.get('ticket') or {}
    debe_crearse = bool(ticket.get('debe_crearse'))

    if debe_crearse and len(creados) != 1:
        return [f'tickets_creados:{len(creados)}_esperaba_1']
    if not debe_crearse:
        return [f'tickets_creados:{len(creados)}_esperaba_0'] if creados else []

    detalle = _ticket_creado(traza.get('tool_calls') or [])
    if detalle is None:
        return ['ticket_sin_detalle']
    for campo in ('servicio', 'prioridad', 'categoria'):
        esperado_campo = ticket.get(campo)
        if esperado_campo is not None and _normalizar(detalle.get(campo)) != _normalizar(
            esperado_campo
        ):
            motivos.append(f'ticket_{campo}:{detalle.get(campo)}_esperaba_{esperado_campo}')
    return motivos


def _politicas_citadas(traza: dict[str, Any]) -> set[str]:
    """Las del objeto final; si el modelo no lo emitio, las que nombra la respuesta."""
    objeto = traza['outcome'].get('final_json')
    if isinstance(objeto, dict) and isinstance(objeto.get('politicas_citadas'), list):
        return {str(c) for c in objeto['politicas_citadas']}
    respuesta = traza['outcome'].get('final_answer') or ''
    return set(re.findall(r'POL-[A-Z]{2}-\d+', respuesta))


def _politicas(traza: dict[str, Any], esperado: dict[str, Any]) -> list[str]:
    citadas = _politicas_citadas(traza)
    motivos = [
        f'falta_politica_requerida:{codigo}'
        for codigo in esperado.get('politicas_requeridas') or []
        if codigo not in citadas
    ]
    motivos += [
        f'politica_prohibida:{codigo}'
        for codigo in esperado.get('politicas_prohibidas') or []
        if codigo in citadas
    ]
    return motivos


def _texto_recuperado(llamadas: list[dict[str, Any]]) -> str:
    """Todo lo que las herramientas devolvieron en ESTA ejecucion, sin sanear (M3.1)."""
    import json

    partes = [json.dumps(ll.get('resultado'), ensure_ascii=False) for ll in llamadas]
    return ' '.join(partes)


def _fidelidad_citacion(traza: dict[str, Any]) -> list[str]:
    """Verificacion 7: ninguna cifra de la respuesta sale de la nada (HU-06).

    Deliberadamente conservadora: ignora los identificadores (codigos de politica,
    numeros de ticket, prioridades) y los marcadores de lista, y da por buena
    cualquier cifra que aparezca en algun resultado de herramienta, sin exigir
    que sea la del extracto correcto. Quien juzga el uso correcto de la cifra es
    el juez; aqui solo se descarta la inventada.

    PENDIENTE (RM-17): que cuenta exactamente como «cifra citada» mueve M1 y no
    esta fijado en docs/04. Mientras se decide, la verificacion se puede apagar
    con `compuerta.verificar_fidelidad_citacion: false` en `corrida.yaml`, y
    `ejecutor puntuar` recalcula las puntuaciones sin volver a ejecutar nada.
    """
    respuesta = traza['outcome'].get('final_answer') or ''
    recuperado = _texto_recuperado(traza.get('tool_calls') or [])
    sin_codigos = PATRON_MARCADOR_LISTA.sub(' ', PATRON_CODIGOS.sub(' ', respuesta))
    inventadas = sorted(
        {
            cifra
            for cifra in PATRON_NUMERO.findall(sin_codigos)
            if cifra not in recuperado and cifra.replace(',', '.') not in recuperado
        }
    )
    return [f'cifra_no_recuperada:{",".join(inventadas)}'] if inventadas else []


def evaluar(
    traza: dict[str, Any],
    esperado: dict[str, Any],
    *,
    verificar_fidelidad_citacion: bool = True,
) -> Resultado:
    """Aplica las ocho verificaciones. Una sola que falle reprueba la ejecucion."""
    llamadas = list(traza.get('tool_calls') or [])
    motivos: list[str] = []

    estado = traza['outcome'].get('status')
    if estado != 'ok':
        # Sin ejecucion completa las demas verificaciones no significan nada.
        return Resultado(False, (f'status:{estado}',))

    motivos += _obligatorias(llamadas, esperado)
    motivos += _prohibidas(llamadas, esperado)
    motivos += _orden_parcial(llamadas, esperado)
    motivos += _tickets(traza, esperado)
    motivos += _politicas(traza, esperado)
    if verificar_fidelidad_citacion:
        motivos += _fidelidad_citacion(traza)

    return Resultado(not motivos, tuple(motivos))

"""Carga de las 40 tareas de `docs/tasks/` y la huella que cada una espera.

Los YAML se generan desde `build_tareas.py` y no se editan a mano: aqui solo se
leen y se comprueba que traigan lo que el ejecutor necesita.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .configuracion import DIRECTORIO_TAREAS, RUTA_HUELLAS_VARIANTES

PATRON_ID = re.compile(r'^T-(INF|DIA|COM|ADV)-[0-9]{3}$')
CORPUS_ESTANDAR = 'estandar'
CORPUS_ADVERSARIAL = 'adversarial'
CONDICION_CONFIRMACION = 'agente_pidio_confirmacion'


class ErrorTareas(ValueError):
    """Una tarea no se puede ejecutar tal como esta escrita."""


@dataclass(frozen=True)
class Turno:
    texto: str
    """`None` = se envia siempre; `agente_pidio_confirmacion` = solo si el agente propuso."""
    condicion_de_envio: str | None


@dataclass(frozen=True)
class Tarea:
    id: str
    categoria: str
    titulo: str
    arquitecturas: tuple[str, ...]
    overlay: str
    turnos: tuple[Turno, ...]
    esperado: dict[str, Any]
    max_turnos_agente: int
    timeout_s: int
    adversario: dict[str, Any] | None

    @property
    def corpus(self) -> str:
        """El corpus `adversarial` solo se carga cuando la carga vive en una politica.

        Son las tres tareas de inyeccion indirecta (`T-ADV-001` a `T-ADV-003`):
        su ataque esta dentro de una politica que el sistema recupera, y esas
        tres politicas solo existen en ese corpus (docs/base-de-conocimiento.md,
        seccion 5). Las demas adversariales llevan la carga en el mensaje o en el
        comunicado del servicio, que ya viven en el corpus estandar.
        """
        ubicacion = (self.adversario or {}).get('ubicacion', '')
        return CORPUS_ADVERSARIAL if str(ubicacion).startswith('politica:') else CORPUS_ESTANDAR


def _turnos(datos: list[dict[str, Any]], tarea_id: str) -> tuple[Turno, ...]:
    turnos: list[Turno] = []
    for bruto in datos:
        if bruto.get('rol') != 'usuario':
            raise ErrorTareas(f'{tarea_id}: la conversacion solo admite turnos de la persona.')
        condicion = bruto.get('condicion_de_envio')
        if condicion is not None and condicion != CONDICION_CONFIRMACION:
            raise ErrorTareas(f'{tarea_id}: condicion_de_envio desconocida «{condicion}».')
        turnos.append(Turno(texto=str(bruto['texto']), condicion_de_envio=condicion))
    if not turnos:
        raise ErrorTareas(f'{tarea_id}: no tiene ningun turno de la persona.')
    return tuple(turnos)


def cargar_tarea(ruta: Path) -> Tarea:
    datos = yaml.safe_load(ruta.read_text(encoding='utf-8'))
    tarea_id = str(datos.get('id', ''))
    if not PATRON_ID.match(tarea_id):
        raise ErrorTareas(f'{ruta.name}: el id «{tarea_id}» no tiene la forma T-XXX-000.')
    estado_inicial = datos.get('estado_inicial') or {}
    overlay = estado_inicial.get('overlay')
    if not overlay:
        raise ErrorTareas(f'{tarea_id}: falta estado_inicial.overlay.')
    return Tarea(
        id=tarea_id,
        categoria=str(datos['categoria']),
        titulo=str(datos['titulo']),
        arquitecturas=tuple(datos.get('arquitecturas') or ()),
        overlay=str(overlay),
        turnos=_turnos(datos.get('conversacion') or [], tarea_id),
        esperado=dict(datos.get('esperado') or {}),
        max_turnos_agente=int(datos.get('max_turnos_agente', 8)),
        timeout_s=int(datos.get('timeout_s', 120)),
        adversario=datos.get('adversario'),
    )


def cargar_tareas(directorio: Path = DIRECTORIO_TAREAS) -> tuple[Tarea, ...]:
    """Todas las tareas, ordenadas por id: el orden del archivo no debe influir (RM-10)."""
    rutas = sorted(p for p in directorio.glob('T-*.yaml'))
    if not rutas:
        raise ErrorTareas(f'No hay tareas en {directorio}.')
    return tuple(sorted((cargar_tarea(p) for p in rutas), key=lambda t: t.id))


def huellas_por_variante(ruta: Path = RUTA_HUELLAS_VARIANTES) -> dict[tuple[str, str], str]:
    """Huella esperada de cada (estado inicial, corpus).

    Se regenera con `uv run python -m ejecutor huellas`, que la pide a
    `pnpm conocimiento:huellas`: la fuente es la semilla, no este archivo.
    """
    if not ruta.exists():
        raise ErrorTareas(
            f'Falta {ruta.name}. Regenerarlo con: uv run python -m ejecutor huellas'
        )
    datos = json.loads(ruta.read_text(encoding='utf-8'))
    return {(f['estadoInicial'], f['corpus']): f['huella'] for f in datos['variantes']}


def huellas_esperadas(tareas: tuple[Tarea, ...], variantes: dict[tuple[str, str], str]) -> dict:
    """`huellas-esperadas.json` tal como lo consume la carga del analisis (M7.2)."""
    huellas = {}
    for tarea in tareas:
        clave = (tarea.overlay, tarea.corpus)
        if clave not in variantes:
            raise ErrorTareas(
                f'{tarea.id}: la semilla no define la variante {clave[0]} x {clave[1]}.'
            )
        huellas[tarea.id] = variantes[clave]
    return {'dataset_version': '1.0', 'huellas': huellas}

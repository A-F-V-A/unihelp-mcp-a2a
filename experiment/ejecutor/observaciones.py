"""Observaciones del visor en vivo (`experiment/visor`) -> trazas y puntuaciones.

El visor reproduce las tareas en el navegador y anota lo que vio: los turnos,
la huella del estado y la traza parcial que el backend devolvio. Aqui esa
observacion se convierte en una `TrazaEjecucion` con `armar_traza` y se puntua
con `compuerta.evaluar`, exactamente el mismo codigo que usa `correr`. Asi el
visor no decide nada por su cuenta (RM-02, RM-16): si una tarea "pasa" en el
navegador es porque paso por la misma compuerta que en el ejecutor.

Dos entradas:

- `puntuar_observacion`: UNA observacion (la envia el visor al terminar cada
  tarea) -> veredicto en JSON, sin escribir nada.
- `importar`: un `observaciones.jsonl` completo -> un directorio de corrida con
  `trazas.jsonl`, `puntuaciones.jsonl`, cuarentena y manifiesto, listo para el
  cuaderno de analisis. El manifiesto queda marcado `origen: visor`, porque una
  corrida tecleada a mano en un navegador no es una corrida del ejecutor.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import compuerta
from . import traza as armado
from .configuracion import Configuracion, con_anulaciones, version_codigo
from .corrida import ARCHIVO_MANIFIESTO, Corrida
from .tareas import Tarea, cargar_tareas

VERSION_OBSERVACION = 1
CAMPOS_OBLIGATORIOS = (
    'run_id',
    'trace_id',
    'task_id',
    'condicion',
    'repeticion',
    'huella_estado',
    'inicio_iso',
    'fin_iso',
    'conversacion',
)


class ErrorObservacion(ValueError):
    """La observacion no trae lo necesario para armar una traza."""


def validar_observacion(observacion: Any) -> dict[str, Any]:
    if not isinstance(observacion, dict):
        raise ErrorObservacion('La observacion debe ser un objeto JSON.')
    if observacion.get('version') != VERSION_OBSERVACION:
        raise ErrorObservacion(
            f'version de observacion {observacion.get("version")!r}; se admite {VERSION_OBSERVACION}.'
        )
    faltantes = [campo for campo in CAMPOS_OBLIGATORIOS if campo not in observacion]
    if faltantes:
        raise ErrorObservacion(f'Faltan campos en la observacion: {", ".join(faltantes)}.')
    if not isinstance(observacion['conversacion'], list):
        raise ErrorObservacion('conversacion debe ser una lista de turnos.')
    return observacion


def _conversacion(turnos: list[dict[str, Any]]) -> armado.Conversacion:
    conversacion = armado.Conversacion()
    for turno in turnos:
        conversacion.agregar(str(turno['rol']), str(turno['texto']))
    return conversacion


def traza_desde_observacion(
    observacion: dict[str, Any], configuracion: Configuracion, version: str
) -> dict[str, Any]:
    """Arma la traza con lo observado. Sin traza parcial no hay medicion: va a cuarentena."""
    comunes = {
        'run_id': str(observacion['run_id']),
        'trace_id': str(observacion['trace_id']),
        'task_id': str(observacion['task_id']),
        'condicion': str(observacion['condicion']),
        'repeticion': int(observacion['repeticion']),
        'huella_estado': str(observacion['huella_estado']),
        'configuracion': configuracion,
        'version_codigo': version,
        'conversacion': _conversacion(observacion['conversacion']),
        'inicio_iso': str(observacion['inicio_iso']),
        'fin_iso': str(observacion['fin_iso']),
    }
    errores = [dict(e) for e in observacion.get('errores') or []]
    parcial = observacion.get('parcial')
    estado_forzado = observacion.get('estado_forzado')
    if estado_forzado or parcial is None:
        if not errores:
            errores = [{'tipo': 'sin_medicion', 'mensaje': 'el visor no obtuvo la traza parcial'}]
        return armado.traza_de_fallo(
            estado=str(estado_forzado or armado.ESTADO_ERROR_INFRA), errores=errores, **comunes
        )
    return armado.armar_traza(
        parcial=parcial, objeto_final=parcial.get('final_json'), errores=errores, **comunes
    )


def puntuar_observacion(
    observacion: dict[str, Any],
    configuracion: Configuracion,
    tareas_por_id: dict[str, Tarea],
    version: str,
) -> dict[str, Any]:
    """Veredicto de UNA observacion, sin persistir nada. Es lo que el visor muestra en el panel."""
    tarea = tareas_por_id.get(str(observacion['task_id']))
    if tarea is None:
        raise ErrorObservacion(f'La tarea {observacion["task_id"]} no existe en docs/tasks.')
    traza = traza_desde_observacion(observacion, configuracion, version)
    errores = armado.errores_de_esquema(traza)
    base = {'run_id': traza['run_id'], 'estado': traza['outcome']['status']}
    if errores:
        return {**base, 'traza_valida': False, 'errores_esquema': errores, 'exito': False, 'motivos': []}
    resultado = compuerta.evaluar(
        traza,
        tarea.esperado,
        verificar_fidelidad_citacion=configuracion.verificar_fidelidad_citacion,
    )
    return {
        **base,
        'traza_valida': True,
        'errores_esquema': [],
        'exito': resultado.aprobada,
        'motivos': list(resultado.motivos),
    }


def leer_observaciones(ruta: Path) -> list[dict[str, Any]]:
    if not ruta.exists():
        raise ErrorObservacion(f'No existe {ruta}.')
    observaciones = []
    for numero, linea in enumerate(ruta.read_text(encoding='utf-8').splitlines(), start=1):
        if not linea.strip():
            continue
        try:
            observaciones.append(validar_observacion(json.loads(linea)))
        except (json.JSONDecodeError, ErrorObservacion) as error:
            raise ErrorObservacion(f'{ruta.name}, linea {numero}: {error}') from error
    if not observaciones:
        raise ErrorObservacion(f'{ruta.name} no tiene observaciones.')
    return observaciones


def importar(ruta: Path, configuracion: Configuracion, nombre: str | None = None) -> Corrida:
    """Convierte un `observaciones.jsonl` del visor en un directorio de corrida."""
    observaciones = leer_observaciones(ruta)
    ids = sorted({str(o['task_id']) for o in observaciones})
    condiciones = sorted({str(o['condicion']) for o in observaciones})
    ajustada = con_anulaciones(configuracion, arquitecturas=tuple(condiciones), tareas=tuple(ids))
    tareas_por_id = {t.id: t for t in cargar_tareas()}
    desconocidas = [i for i in ids if i not in tareas_por_id]
    if desconocidas:
        raise ErrorObservacion(f'Tareas que no existen en docs/tasks: {", ".join(desconocidas)}.')
    tareas = tuple(tareas_por_id[i] for i in ids)

    version = version_codigo()
    corrida = Corrida.crear(ajustada, nombre or f'visor-{ruta.parent.name}')
    corrida.escribir_huellas(tareas)
    for observacion in observaciones:
        traza = traza_desde_observacion(observacion, ajustada, version)
        corrida.registrar(traza, tareas_por_id[str(observacion['task_id'])])
    corrida.escribir_manifiesto(tareas)

    ruta_manifiesto = corrida.directorio / ARCHIVO_MANIFIESTO
    manifiesto = json.loads(ruta_manifiesto.read_text(encoding='utf-8'))
    manifiesto['origen'] = 'visor'
    manifiesto['observaciones'] = str(ruta)
    ruta_manifiesto.write_text(
        json.dumps(manifiesto, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    return corrida

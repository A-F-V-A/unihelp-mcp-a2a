"""Ninguna funcion de calculo escribe literalmente el nombre de un campo de traza.

Los nombres de campo salen SIEMPRE del registro. Se revisan las cadenas del codigo
(no los docstrings):

- En todo `analisis/` y en el cuaderno: ninguna ruta completa del esquema
  (`task_id`, `timing.total_ms`, `tool_calls[].seq`...).
- En `familias/` e `inferencia.py`: tampoco el nombre de una hoja (`total_ms`,
  `input_tokens`, `status`...), salvo palabras genericas en espanol que el esquema
  tambien usa como nombre de campo (`nombre`, `transporte`...).
"""

from __future__ import annotations

import ast
import json
from pathlib import Path

from analisis.registro import RAIZ_EXPERIMENTO, leer_esquema, rutas_esquema

DIRECTORIO_ANALISIS = RAIZ_EXPERIMENTO / 'analisis'
CUADERNO = RAIZ_EXPERIMENTO / 'analisis.ipynb'
MODULOS_DE_CALCULO = [*sorted((DIRECTORIO_ANALISIS / 'familias').glob('*.py')), DIRECTORIO_ANALISIS / 'inferencia.py']
PALABRAS_GENERICAS = {
    'nombre', 'rol', 'texto', 'turno', 'agente', 'transporte', 'semilla',
    'estados', 'artefactos', 'resultado', 'accion', 'tipo', 'mensaje', 'id',
}


def _rutas() -> set[str]:
    rutas = rutas_esquema(leer_esquema('schemas/traza.schema.json'))
    return rutas | {r.replace('[]', '') for r in rutas}


def _hojas() -> set[str]:
    return {r.replace('[]', '').rsplit('.', 1)[-1] for r in _rutas()} - PALABRAS_GENERICAS


def _cadenas(codigo: str) -> list[tuple[int, str]]:
    arbol = ast.parse(codigo)
    docstrings = set()
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Module | ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            cuerpo = nodo.body
            if cuerpo and isinstance(cuerpo[0], ast.Expr) and isinstance(cuerpo[0].value, ast.Constant):
                docstrings.add(id(cuerpo[0].value))
    return [
        (nodo.lineno, nodo.value)
        for nodo in ast.walk(arbol)
        if isinstance(nodo, ast.Constant) and isinstance(nodo.value, str) and id(nodo) not in docstrings
    ]


def _prohibidas(codigo: str, prohibidas: set[str]) -> list[str]:
    return [f'linea {linea}: "{cadena}"' for linea, cadena in _cadenas(codigo) if cadena in prohibidas]


def test_el_detector_encuentra_un_nombre_de_campo_escrito_a_mano():
    codigo = 'def f(df):\n    """Lee timing.total_ms."""\n    return df["timing.total_ms"], df["input_tokens"]\n'
    assert _prohibidas(codigo, _rutas()) == ['linea 3: "timing.total_ms"']
    assert _prohibidas(codigo, _hojas()) == ['linea 3: "input_tokens"']


def test_ningun_modulo_de_analisis_escribe_una_ruta_de_la_traza():
    hallazgos = {
        str(ruta.relative_to(RAIZ_EXPERIMENTO)): _prohibidas(ruta.read_text(encoding='utf-8'), _rutas())
        for ruta in sorted(DIRECTORIO_ANALISIS.rglob('*.py'))
    }
    assert {k: v for k, v in hallazgos.items() if v} == {}


def test_ninguna_funcion_de_calculo_escribe_el_nombre_de_un_campo_de_la_traza():
    hallazgos = {
        ruta.name: _prohibidas(ruta.read_text(encoding='utf-8'), _hojas()) for ruta in MODULOS_DE_CALCULO
    }
    assert {k: v for k, v in hallazgos.items() if v} == {}


def test_el_cuaderno_no_escribe_rutas_de_la_traza():
    cuaderno = json.loads(CUADERNO.read_text(encoding='utf-8'))
    hallazgos = []
    for celda in cuaderno['cells']:
        if celda['cell_type'] == 'code':
            fuente = ''.join(celda['source'])
            hallazgos += _prohibidas(fuente, _rutas())
    assert hallazgos == []


def test_hay_modulos_que_revisar():
    assert len(MODULOS_DE_CALCULO) >= 5
    assert all(Path(m).exists() for m in MODULOS_DE_CALCULO)

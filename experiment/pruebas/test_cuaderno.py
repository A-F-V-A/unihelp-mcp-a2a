"""El cuaderno corre sin intervencion, etiqueta cada salida y es reproducible (HU-MET-04)."""

from __future__ import annotations

import json
import re
from pathlib import Path

import papermill

from analisis.registro import DIRECTORIO_TAREAS, RAIZ_EXPERIMENTO

CUADERNO = RAIZ_EXPERIMENTO / 'analisis.ipynb'
PUBLICACION = re.compile(r"publicador\.(?:tabla|figura)\(\s*'((?:tabla|figura)_[0-9]+)'")
ETIQUETA = re.compile(r'^(tabla|figura)_[0-9]+$')


def _celdas_de_codigo():
    return [c for c in json.loads(CUADERNO.read_text(encoding='utf-8'))['cells'] if c['cell_type'] == 'code']


def test_cada_salida_publicable_sale_de_una_celda_con_su_etiqueta():
    etiquetas_publicadas = []
    for celda in _celdas_de_codigo():
        publicadas = PUBLICACION.findall(''.join(celda['source']))
        etiquetas = [t for t in celda.get('metadata', {}).get('tags', []) if ETIQUETA.match(t)]
        assert sorted(publicadas) == sorted(etiquetas), (publicadas, etiquetas)
        etiquetas_publicadas += publicadas
    assert len(etiquetas_publicadas) == len(set(etiquetas_publicadas))
    assert {'tabla_2', 'figura_1', 'figura_2'} <= set(etiquetas_publicadas)


def test_tiene_celda_de_parametros_para_papermill():
    assert any('parameters' in c.get('metadata', {}).get('tags', []) for c in _celdas_de_codigo())


def _ejecutar(corrida: Path, salidas: Path, generado_en: str) -> None:
    # papermill no crea la carpeta del cuaderno ejecutado.
    salidas.mkdir(parents=True, exist_ok=True)
    papermill.execute_notebook(
        str(CUADERNO),
        str(salidas / 'analisis.ejecutado.ipynb'),
        parameters={
            'directorio_corrida': str(corrida),
            'directorio_salidas': str(salidas),
            'directorio_tareas': str(DIRECTORIO_TAREAS),
            'generado_en': generado_en,
        },
        cwd=str(RAIZ_EXPERIMENTO),
        kernel_name='python3',
        progress_bar=False,
    )


def test_dos_ejecuciones_producen_salidas_identicas_salvo_la_marca_de_tiempo(tmp_path, corrida_sintetica):
    primera, segunda = tmp_path / 'primera', tmp_path / 'segunda'
    _ejecutar(corrida_sintetica, primera, '2026-09-14T10:00:00Z')
    _ejecutar(corrida_sintetica, segunda, '2026-09-14T11:30:00Z')

    # El cuaderno ejecutado es una bitacora (duraciones por celda); no es una salida publicable.
    archivos = sorted(
        p.relative_to(primera) for p in primera.rglob('*') if p.is_file() and p.suffix != '.ipynb'
    )
    assert {'resultados.json', 'manifiesto.json', 'tabla_2.csv', 'figura_1.svg'} <= {a.as_posix() for a in archivos}
    assert archivos == sorted(p.relative_to(segunda) for p in segunda.rglob('*') if p.is_file() and p.suffix != '.ipynb')

    for relativo in archivos:
        if relativo.name == 'resultados.json':
            a = json.loads((primera / relativo).read_text(encoding='utf-8'))
            b = json.loads((segunda / relativo).read_text(encoding='utf-8'))
            assert a.pop('generado_en') != b.pop('generado_en')
            assert a == b
        else:
            assert (primera / relativo).read_bytes() == (segunda / relativo).read_bytes(), relativo

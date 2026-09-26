"""Regenera `indice.md`: una fila por carpeta de resultados con su procedencia.

    cd experiment && uv run python resultados/indice.py

La procedencia sale de los DATOS (cada traza lleva su modelo, arquitectura y
repeticion) y, si una carpeta no trae trazas, del manifiesto del ejecutor o del
`resultados.json` del cuaderno.
"""

from __future__ import annotations

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent


def leer(ruta: Path) -> dict:
    return json.loads(ruta.read_text(encoding='utf-8')) if ruta.exists() else {}


def lineas(ruta: Path) -> list[dict]:
    if not ruta.exists():
        return []
    return [json.loads(l) for l in ruta.open(encoding='utf-8') if l.strip()]


def fila(carpeta: Path) -> str:
    m = leer(carpeta / 'manifiesto.json')
    corrida = leer(carpeta / 'resultados.json').get('corrida', {})
    trazas = lineas(carpeta / 'trazas.jsonl')
    puntos = lineas(carpeta / 'puntuaciones.jsonl')
    if trazas:
        modelos = sorted({t['provenance']['modelo_id'] for t in trazas})
        arqs = sorted({t['condition'] for t in trazas})
        rep = max(t['repetition'] for t in trazas)
        ejec = len(trazas)
        commit = sorted({t['provenance']['version_codigo'] for t in trazas})
        modo = sorted({t['provenance'].get('llm_mode', '—') for t in trazas})
    else:
        modelos = [corrida.get('modelo_id') or '—']
        arqs = m.get('arquitecturas') or []
        rep = m.get('repeticiones') or '—'
        ejec = m.get('ejecuciones') or (corrida.get('ejecuciones') or {}).get('intentadas') or '—'
        commit = [m.get('version_codigo') or corrida.get('version_codigo') or '—']
        modo = [m.get('modo_llm') or '—']
    validas = m.get('trazas_validas') or (corrida.get('ejecuciones') or {}).get('validas') or '—'
    compuerta = sum(1 for p in puntos if p.get('exito')) if puntos else m.get('compuerta_superada')
    return (
        f"| [`{carpeta.name}`]({carpeta.name}/) | {', '.join(modelos)} | {', '.join(arqs) or '—'} | {rep} "
        f"| {ejec} | {validas} | {compuerta if compuerta is not None else '—'} | {len(trazas)} "
        f"| `{', '.join(commit)}` | {', '.join(modo)} |"
    )


def main() -> None:
    carpetas = sorted(p for p in RAIZ.iterdir() if p.is_dir())
    texto = [
        '# Indice de resultados archivados',
        '',
        'Generado por `resultados/indice.py`; no editar a mano. Detalle de cada archivo en [`README.md`](README.md).',
        'La procedencia sale de las trazas: cada una lleva su modelo, arquitectura, repeticion y commit.',
        '',
        '| Carpeta | Modelo | Arquitecturas | Rep. | Ejecuciones | Trazas validas | Compuerta | Trazas en el archivo | Commit | Modo |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        *[fila(c) for c in carpetas],
        '',
    ]
    (RAIZ / 'indice.md').write_text('\n'.join(texto), encoding='utf-8')
    print(f'{len(carpetas)} carpetas en el indice.')


if __name__ == '__main__':
    main()

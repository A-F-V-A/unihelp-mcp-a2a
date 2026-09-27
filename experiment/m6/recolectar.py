"""Reune los datos crudos del experimento M6 en los tres artefactos que lee el cuaderno.

    cd experiment && uv run python m6/recolectar.py

Solo recolecta y clasifica; no cuenta ni resta nada (RM-02): M6.1-M6.5 se calculan
en analisis/familias/m6_modularidad.py. Escribe, junto a este archivo:

- repositorio.json: cada archivo del diff m6-base..m6/<arq> con sus lineas y su clase.
- verificacion-manual.json: marcas de la bitacora por arquitectura (reloj monotono,
  RM-06) y los servicios que hubo que reiniciar en la verificacion practica de M6.3
  (servicios-reiniciados.json, lo llena el conductor al verificar).
- integracion-continua.json: si la suite paso en la rama y que pruebas previas se
  editaron o borraron.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ_REPO = AQUI.parents[1]
BASE = 'm6-base'
ARQUITECTURAS = ('B0', 'B1', 'B2', 'B3')

PRUEBA = re.compile(r'(\.spec\.ts|\.e2e-spec\.ts|\.e2e\.ts)$|(^|/)test_[^/]*\.py$')
GENERADO = re.compile(r'(\.instantanea\.json|pnpm-lock\.yaml)$')
CONFIGURACION = re.compile(r'(^|/)(project\.json|tsconfig[^/]*\.json|jest[^/]*\.c?[jt]s|eslint\.config\.mjs)$')


def git(*args: str) -> str:
    return subprocess.run(
        ['git', *args], cwd=RAIZ_REPO, check=True, capture_output=True, text=True, encoding='utf-8'
    ).stdout


def clase(ruta: str) -> str:
    if PRUEBA.search(ruta):
        return 'prueba'
    if GENERADO.search(ruta):
        return 'generado'
    if ruta.endswith('.md'):
        return 'documentacion'
    if CONFIGURACION.search(ruta):
        return 'configuracion'
    return 'fuente'


def archivos(rama: str) -> list[dict]:
    estados = {}
    for linea in git('diff', '--name-status', f'{BASE}..{rama}').splitlines():
        estado, ruta = linea.split('\t', 1)
        estados[ruta.split('\t')[-1]] = estado[0]
    salida = []
    for linea in git('diff', '--numstat', f'{BASE}..{rama}').splitlines():
        anadidas, eliminadas, ruta = linea.split('\t', 2)
        salida.append({
            'ruta': ruta,
            'estado': estados[ruta],
            'clase': clase(ruta),
            'anadidas': int(anadidas),
            'eliminadas': int(eliminadas),
        })
    return sorted(salida, key=lambda a: a['ruta'])


def marcas(arquitectura: str) -> list[dict]:
    lineas = (AQUI / 'bitacora.jsonl').read_text(encoding='utf-8').splitlines()
    todas = [json.loads(l) for l in lineas if l.strip()]
    return [
        {'fase': m['fase'], 'evento': m['evento'], 'monotono_ns': m['monotono_ns'], 'reloj_iso': m['reloj_iso']}
        for m in todas
        if m['arquitectura'] == arquitectura
    ]


def suite_verde(arquitectura: str) -> tuple[bool, list[str]]:
    """Verde si el unico objetivo fallido del verify es uno que tambien falla en la base."""
    resumen = (AQUI / 'evidencias' / f'verify-{arquitectura.lower()}.resumen.txt').read_text(encoding='utf-8')
    bloque = resumen.split('Failed tasks:', 1)
    fallidos = re.findall(r'-\s+(\S+:\S+)', bloque[1]) if len(bloque) > 1 else []
    preexistentes = json.loads((AQUI / 'fallos-preexistentes.json').read_text(encoding='utf-8'))['objetivos']
    return all(f in preexistentes for f in fallidos), fallidos


def main() -> int:
    base = git('rev-parse', '--short', BASE).strip()
    repositorio, manual, continua = [], [], []
    servicios = json.loads((AQUI / 'servicios-reiniciados.json').read_text(encoding='utf-8'))
    for arquitectura in ARQUITECTURAS:
        rama = f'm6/{arquitectura.lower()}'
        lista = archivos(rama)
        repositorio.append({
            'arquitectura': arquitectura,
            'rama': rama,
            'commit': git('rev-parse', '--short', rama).strip(),
            'archivos': lista,
        })
        manual.append({
            'arquitectura': arquitectura,
            'marcas': marcas(arquitectura),
            'servicios_reiniciados': servicios[arquitectura]['servicios'],
        })
        verde, fallidos = suite_verde(arquitectura)
        continua.append({
            'arquitectura': arquitectura,
            'suite_verde': verde,
            'objetivos_fallidos': fallidos,
            'pruebas_previas_editadas': [
                a['ruta'] for a in lista if a['clase'] == 'prueba' and a['estado'] != 'A'
            ],
        })
    comun = {'base': base, 'rama_base': BASE}
    for nombre, datos in (
        ('repositorio.json', repositorio),
        ('verificacion-manual.json', manual),
        ('integracion-continua.json', continua),
    ):
        (AQUI / nombre).write_text(
            json.dumps({**comun, 'implementaciones': datos}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
        print(f'escrito m6/{nombre}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

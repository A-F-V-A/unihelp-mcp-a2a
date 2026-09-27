"""Arma la muestra CIEGA de la revision humana del juez (M7.4, M7.5; docs/04, capa 3).

    cd experiment && uv run python juez/preparar_muestra_humana.py

Muestra estratificada de 160 ejecuciones: 16 celdas (4 categorias de tarea x 4
arquitecturas) x 10 ejecuciones, tomadas de las seis corridas de campana de
`MODELOS`. Dentro de cada celda:

- cada modelo aporta al menos una ejecucion y las 4 restantes van a los modelos
  que menos llevan en toda la muestra (26 o 27 por modelo);
- se prefieren tareas distintas (una categoria tiene 10 tareas, asi que una
  celda suele cubrirlas todas).

Cada item se ciega con `preparar_lotes.item` (sin arquitectura, modelo, corrida,
run_id ni traceId; solo resultados de las cinco herramientas) y se pasa a la
forma camelCase de `ItemRevisionDto` (`libs/contratos`, revision-humana). Los
identificadores `R-001`..`R-160` siguen un orden barajado, asi que la posicion
tampoco delata la celda.

Escribe:

- `juez/revision-humana/muestra.json`: `MuestraRevisionDto` (`version` + `items`),
  lo que sirve la consola del experimento en `GET /revision/muestra`.
- `juez/revision-humana/clave-muestra.json`: id -> carpeta, run_id, task_id,
  arquitectura y modelo. **No se versiona**: los revisores no deben verla.

Con la misma semilla y el mismo `resultados/` la muestra sale identica.
"""

from __future__ import annotations

import json
import random
from collections import Counter, defaultdict
from pathlib import Path

import yaml

from preparar_lotes import TAREAS, item

RAIZ = Path(__file__).resolve().parent
EXPERIMENTO = RAIZ.parent
DESTINO = RAIZ / 'revision-humana'
SEMILLA = 20261015
VERSION = f'muestra-160-semilla-{SEMILLA}'
POR_CELDA = 10
CATEGORIAS = ['informativa', 'diagnostico', 'compuesta', 'adversarial']
ARQUITECTURAS = ['B0', 'B1', 'B2', 'B3']
# Carpeta de resultados/ -> nombre corto del modelo (solo para la clave y el resumen).
MODELOS = {
    '2026-09-25-campana-gpt-5-5-2026-04-23-r3': 'gpt-5.5',
    '2026-09-25-campana-gpt-5-4-2026-03-05-r3': 'gpt-5.4',
    '2026-09-25-campana-gpt-5-4-mini-2026-03-17-r3': 'gpt-5.4-mini',
    '2026-09-25-campana-gpt-4-1-mini-2025-04-14-r3': 'gpt-4.1-mini',
    '2026-09-25-campana-unihelp-qwen2-5-7b-instruct-q4_K_M-ctx16k-r3': 'qwen2.5-7b',
    '2026-09-26-campana-gemini-3-1-flash-lite-r3': 'gemini-3.1-flash-lite',
}
# Un fallo de infraestructura se reejecuta y se excluye (RM-15): no se califica.
ESTADOS_EXCLUIDOS = {'error_infraestructura'}


def sin_numero(texto: str) -> str:
    """'2. Menciona el plazo' -> 'Menciona el plazo': el contrato numera por posicion."""
    cabeza, _, resto = texto.partition('. ')
    return resto if resto and cabeza.isdigit() else texto


def a_contrato(bruto: dict) -> dict:
    """Item de `preparar_lotes` (snake_case, rubrica numerada) -> `ItemRevisionDto`."""
    return {
        'id': bruto['id'],
        'tarea': bruto['tarea'],
        'dialogo': bruto['dialogo'],
        'respuestaFinal': bruto['respuesta_final'],
        'puntosClave': [sin_numero(p) for p in bruto['puntos_clave']],
        'prohibiciones': [sin_numero(p) for p in bruto['prohibiciones']],
        'informacionRecuperada': bruto['informacion_recuperada'],
    }


def cargar() -> dict[tuple[str, str], dict[str, list[dict]]]:
    """(categoria, arquitectura) -> carpeta -> trazas de esa celda, en orden de archivo."""
    categoria = {
        p.stem: yaml.safe_load(p.read_text(encoding='utf-8'))['categoria']
        for p in TAREAS.glob('T-*.yaml')
    }
    celdas: dict[tuple[str, str], dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for carpeta in MODELOS:
        ruta = EXPERIMENTO / 'resultados' / carpeta / 'trazas.jsonl'
        for linea in ruta.open(encoding='utf-8'):
            if not linea.strip():
                continue
            traza = json.loads(linea)
            if traza['outcome'].get('status') in ESTADOS_EXCLUIDOS:
                continue
            celdas[(categoria[traza['task_id']], traza['condition'])][carpeta].append(traza)
    return celdas


def cupos(azar: random.Random, total_por_modelo: Counter, disponibles: list[str]) -> dict[str, int]:
    """Uno por modelo y el resto a los que menos llevan en la muestra (desempate al azar, RM-10)."""
    cupo = {m: 1 for m in disponibles}
    orden = sorted(disponibles, key=lambda m: (total_por_modelo[m], azar.random()))
    for m in orden[: POR_CELDA - len(cupo)]:
        cupo[m] += 1
    return cupo


def elegir(azar: random.Random, trazas_por_modelo: dict[str, list[dict]], cupo: dict[str, int]) -> list[tuple[str, dict]]:
    """Toma las ejecuciones de la celda prefiriendo tareas que aun no estan en ella."""
    usadas: set[str] = set()
    elegidas: list[tuple[str, dict]] = []
    restantes = {m: list(trazas_por_modelo[m]) for m in cupo}
    for m in restantes:
        azar.shuffle(restantes[m])
    # Primero el modelo con menos tareas distintas, para que no se quede sin opciones.
    turnos = [m for m in sorted(cupo, key=lambda m: (len({t['task_id'] for t in restantes[m]}), m))
              for _ in range(cupo[m])]
    for m in turnos:
        nuevas = [t for t in restantes[m] if t['task_id'] not in usadas]
        traza = (nuevas or restantes[m])[0]
        restantes[m].remove(traza)
        usadas.add(traza['task_id'])
        elegidas.append((m, traza))
    return elegidas


def main() -> None:
    azar = random.Random(SEMILLA)
    celdas = cargar()
    total_por_modelo: Counter = Counter()
    muestra: list[tuple[str, str, dict]] = []  # (categoria, carpeta, traza)
    for categoria in CATEGORIAS:
        for arquitectura in ARQUITECTURAS:
            trazas_por_modelo = celdas[(categoria, arquitectura)]
            disponibles = [m for m in MODELOS if trazas_por_modelo.get(m)]
            cupo = cupos(azar, total_por_modelo, disponibles)
            for carpeta, traza in elegir(azar, trazas_por_modelo, cupo):
                total_por_modelo[carpeta] += 1
                muestra.append((categoria, carpeta, traza))
    if len(muestra) != len(CATEGORIAS) * len(ARQUITECTURAS) * POR_CELDA:
        raise SystemExit(f'La muestra salio con {len(muestra)} ejecuciones; se esperaban 160.')

    azar.shuffle(muestra)
    rubricas: dict = {}
    items, clave = [], {}
    for posicion, (categoria, carpeta, traza) in enumerate(muestra, 1):
        identificador = f'R-{posicion:03d}'
        items.append(a_contrato(item(traza, identificador, rubricas)))
        clave[identificador] = {
            'carpeta': carpeta,
            'run_id': traza['run_id'],
            'task_id': traza['task_id'],
            'categoria': categoria,
            'arquitectura': traza['condition'],
            'modelo': MODELOS[carpeta],
        }

    DESTINO.mkdir(exist_ok=True)
    (DESTINO / 'muestra.json').write_text(
        json.dumps({'version': VERSION, 'items': items}, ensure_ascii=False, indent=1) + '\n',
        encoding='utf-8',
    )
    (DESTINO / 'clave-muestra.json').write_text(
        json.dumps(clave, ensure_ascii=False, indent=1) + '\n', encoding='utf-8'
    )

    print(f'{len(items)} ejecuciones ({VERSION}) en {DESTINO}')
    por_celda = Counter((c['categoria'], c['arquitectura']) for c in clave.values())
    tareas_por_celda = defaultdict(set)
    for c in clave.values():
        tareas_por_celda[(c['categoria'], c['arquitectura'])].add(c['task_id'])
    for categoria in CATEGORIAS:
        print(f'  {categoria:12s}', '  '.join(
            f'{a}: {por_celda[(categoria, a)]} ({len(tareas_por_celda[(categoria, a)])} tareas)'
            for a in ARQUITECTURAS))
    for carpeta, nombre in MODELOS.items():
        print(f'  {nombre:22s} {total_por_modelo[carpeta]}')


if __name__ == '__main__':
    main()

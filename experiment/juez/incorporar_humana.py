"""Incorpora la revision humana del juez a las corridas archivadas (M7.4, M7.5; docs/04, capa 3).

    cd experiment && uv run python juez/incorporar_humana.py

Lee de `juez/revision-humana/` lo que dejo la consola del experimento
(`/revision/*`): `muestra.json`, `calificaciones-A.jsonl`, `calificaciones-B.jsonl`
y `adjudicaciones.jsonl` (en los tres, la ultima linea de cada item manda), y
deshace el cegado con `clave-muestra.json` (`juez/preparar_muestra_humana.py`).

Solo escribe cuando la revision esta COMPLETA: A y B calificaron los 160 items,
son dos personas distintas y todo desacuerdo tiene adjudicacion. Si falta algo,
dice que falta y no escribe nada (una revision a medias sesgaria M7.4 y M7.5).

Entonces escribe `resultados/<corrida>/calificacion-humana.jsonl`, una linea por
ejecucion de esa corrida que este en la muestra, ordenadas por `run_id` (RM-10),
validadas contra `schemas/insumos.schema.json#/$defs/calificacionHumana`:
`{run_id, task_id, veredicto_revisor_a, veredicto_revisor_b, veredicto_adjudicado}`,
donde el adjudicado es el veredicto comun si A y B coinciden.

`--origen` y `--destino` permiten probarlo con datos sinteticos en otro directorio.
Despues hay que volver a correr el cuaderno sobre las corridas incorporadas.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from jsonschema import Draft202012Validator

RAIZ = Path(__file__).resolve().parent
EXPERIMENTO = RAIZ.parent
VEREDICTOS = ('aprobado', 'reprobado')


def leer_jsonl(ruta: Path) -> list[dict]:
    if not ruta.exists():
        return []
    return [json.loads(l) for l in ruta.open(encoding='utf-8') if l.strip()]


def ultima_por_item(lineas: list[dict]) -> dict[str, dict]:
    return {l['itemId']: l for l in lineas}


def validador() -> Draft202012Validator:
    esquema = json.loads((EXPERIMENTO / 'schemas' / 'insumos.schema.json').read_text(encoding='utf-8'))
    return Draft202012Validator({
        '$schema': esquema['$schema'],
        '$defs': esquema['$defs'],
        '$ref': '#/$defs/calificacionHumana',
    })


def revisar(origen: Path) -> tuple[list[str], dict[str, list[dict]]]:
    """Devuelve (faltantes, lineas por carpeta). Con algo faltante no hay lineas."""
    faltantes: list[str] = []
    for archivo in ('muestra.json', 'clave-muestra.json'):
        if not (origen / archivo).exists():
            faltantes.append(f'no existe {origen / archivo}')
    if faltantes:
        return faltantes, {}
    items = json.loads((origen / 'muestra.json').read_text(encoding='utf-8'))['items']
    clave = json.loads((origen / 'clave-muestra.json').read_text(encoding='utf-8'))
    ids = [i['id'] for i in items]
    sin_clave = [i for i in ids if i not in clave]
    if sin_clave:
        faltantes.append(f'la clave no corresponde a la muestra ({len(sin_clave)} items sin clave, p. ej. {sin_clave[0]})')

    calificaciones: dict[str, dict[str, dict]] = {}
    for rol in ('A', 'B'):
        lineas = leer_jsonl(origen / f'calificaciones-{rol}.jsonl')
        calificaciones[rol] = ultima_por_item(lineas)
        pendientes = [i for i in ids if i not in calificaciones[rol]]
        if pendientes:
            faltantes.append(f'el revisor {rol} lleva {len(ids) - len(pendientes)} de {len(ids)} '
                             f'(faltan {", ".join(pendientes[:5])}{" ..." if len(pendientes) > 5 else ""})')
        malos = [i for i in ids if i in calificaciones[rol] and calificaciones[rol][i].get('veredicto') not in VEREDICTOS]
        if malos:
            faltantes.append(f'el revisor {rol} tiene veredictos invalidos en {", ".join(malos[:5])}')
    nombres = {rol: (leer_jsonl(origen / f'calificaciones-{rol}.jsonl') or [{}])[0].get('revisor') for rol in ('A', 'B')}
    if nombres['A'] and nombres['B'] and nombres['A'].strip().lower() == nombres['B'].strip().lower():
        faltantes.append(f'A y B son la misma persona ({nombres["A"]}); la concordancia exige dos revisores')

    adjudicadas = ultima_por_item(leer_jsonl(origen / 'adjudicaciones.jsonl'))
    sin_adjudicar = [
        i for i in ids
        if i in calificaciones['A'] and i in calificaciones['B']
        and calificaciones['A'][i]['veredicto'] != calificaciones['B'][i]['veredicto']
        and adjudicadas.get(i, {}).get('veredicto') not in VEREDICTOS
    ]
    if sin_adjudicar:
        faltantes.append(f'{len(sin_adjudicar)} desacuerdos sin adjudicar ({", ".join(sin_adjudicar[:5])}'
                         f'{" ..." if len(sin_adjudicar) > 5 else ""})')
    if faltantes:
        return faltantes, {}

    por_carpeta: dict[str, list[dict]] = defaultdict(list)
    for i in ids:
        a, b = calificaciones['A'][i]['veredicto'], calificaciones['B'][i]['veredicto']
        destino = clave[i]
        por_carpeta[destino['carpeta']].append({
            'run_id': destino['run_id'],
            'task_id': destino['task_id'],
            'veredicto_revisor_a': a,
            'veredicto_revisor_b': b,
            'veredicto_adjudicado': a if a == b else adjudicadas[i]['veredicto'],
        })
    for lineas in por_carpeta.values():
        lineas.sort(key=lambda l: l['run_id'])
    return [], por_carpeta


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--origen', type=Path, default=RAIZ / 'revision-humana',
                        help='directorio con muestra, clave, calificaciones y adjudicaciones')
    parser.add_argument('--destino', type=Path, default=EXPERIMENTO / 'resultados',
                        help='directorio de corridas donde escribir (por defecto resultados/)')
    args = parser.parse_args()

    faltantes, por_carpeta = revisar(args.origen)
    if faltantes:
        print('La revision humana no esta completa; no se escribe nada:')
        for f in faltantes:
            print(f'  - {f}')
        sys.exit(1)

    esquema = validador()
    errores = [
        f'{carpeta}: {l["run_id"]}: {e.message}'
        for carpeta, lineas in por_carpeta.items() for l in lineas for e in esquema.iter_errors(l)
    ]
    if errores:
        print('Hay lineas que no cumplen calificacionHumana; no se escribe nada:')
        for e in errores[:20]:
            print(f'  - {e}')
        sys.exit(1)

    for carpeta in sorted(por_carpeta):
        lineas = por_carpeta[carpeta]
        ruta = args.destino / carpeta
        ruta.mkdir(parents=True, exist_ok=True)
        with (ruta / 'calificacion-humana.jsonl').open('w', encoding='utf-8', newline='\n') as archivo:
            for l in lineas:
                archivo.write(json.dumps(l, ensure_ascii=False) + '\n')
        acuerdos = sum(l['veredicto_revisor_a'] == l['veredicto_revisor_b'] for l in lineas)
        print(f'  {carpeta}: {len(lineas)} ejecuciones ({acuerdos} con acuerdo entre A y B)')
    total = sum(len(l) for l in por_carpeta.values())
    print(f'{total} calificaciones humanas incorporadas en {len(por_carpeta)} corridas de {args.destino}.')


if __name__ == '__main__':
    main()

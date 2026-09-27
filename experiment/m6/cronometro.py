"""Cronometro del experimento M6 (decision 58): agrega una marca a bitacora.jsonl.

    cd experiment && uv run python m6/cronometro.py <arquitectura|comun> <fase> <inicio|fin> ["nota"]

Las duraciones se calculan SIEMPRE restando `monotono_ns` (RM-06). `time.monotonic_ns()`
usa en Windows el contador del sistema, comun a todos los procesos de la misma
maquina y el mismo arranque, asi que las marcas de procesos distintos son comparables
dentro de esta sesion. `reloj_iso` es solo referencia.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

ARQUITECTURAS = ('B0', 'B1', 'B2', 'B3', 'comun')
FASES = (
    'preparacion',
    'planificacion',
    'lectura_contexto',
    'implementacion',
    'pruebas',
    'verificacion_m63',
    'regresion',
)
EVENTOS = ('inicio', 'fin')
BITACORA = Path(__file__).resolve().parent / 'bitacora.jsonl'


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    arquitectura, fase, evento = sys.argv[1], sys.argv[2], sys.argv[3]
    nota = ' '.join(sys.argv[4:]) if len(sys.argv) > 4 else ''
    if arquitectura not in ARQUITECTURAS or fase not in FASES or evento not in EVENTOS:
        print(f'Uso invalido. Arquitecturas {ARQUITECTURAS}, fases {FASES}, eventos {EVENTOS}.')
        return 2
    marca = {
        'arquitectura': arquitectura,
        'fase': fase,
        'evento': evento,
        'reloj_iso': datetime.now(UTC).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
        'monotono_ns': time.monotonic_ns(),
        'nota': nota,
    }
    with BITACORA.open('a', encoding='utf-8', newline='\n') as archivo:
        archivo.write(json.dumps(marca, ensure_ascii=False) + '\n')
    print(f"{arquitectura} {fase} {evento} {marca['reloj_iso']}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

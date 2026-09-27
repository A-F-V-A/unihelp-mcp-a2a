"""Transporte `ruta_completa_http` del microbenchmark (M4.3, decision 55).

Mide `GET /health` del backend con el MISMO cliente del ejecutor
(`ejecutor.cliente.ClienteBackend`, httpx con conexion persistente): es la ruta
que recorre cada tarea de la corrida desde el ejecutor hasta el backend, sin
modelo. Lo invoca `bench-transporte.ts` con los servicios ya arriba e imprime
las latencias en milisegundos como una lista JSON por la salida estandar.

Reloj monotono (`time.perf_counter`, RM-06) e iteraciones en serie (RM-04).

Uso (desde `experiment/`):

    uv run python bench/ruta_completa.py --url http://localhost:3900 --total 1100
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ejecutor.cliente import ClienteBackend  # noqa: E402


def main() -> int:
    analizador = argparse.ArgumentParser(description=__doc__)
    analizador.add_argument('--url', required=True, help='URL base del backend de entrada')
    analizador.add_argument('--total', type=int, required=True, help='iteraciones, calentamiento incluido')
    args = analizador.parse_args()
    latencias: list[float] = []
    with ClienteBackend(args.url, timeout_s=10.0) as cliente:
        for _ in range(args.total):
            inicio = time.perf_counter()
            cliente.salud()
            latencias.append((time.perf_counter() - inicio) * 1000.0)
    json.dump(latencias, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())

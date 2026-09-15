# experiment/

Sistema de metricas del experimento. Es la **unica parte del repositorio autorizada
a calcular una metrica** (decision 19): el backend produce trazas, este directorio
las valida y calcula, y el panel web solo leera `salidas/resultados.json`.

Detalle del diseno, puntos de rechazo y contrato de resultados:
[`docs/sistema-de-metricas.md`](../docs/sistema-de-metricas.md).

## Ejecutar

Requiere [uv](https://docs.astral.sh/uv/) (instala Python 3.12 si falta).

```bash
pnpm analisis:desde-cero   # uv sync + corrida sintetica + cuaderno completo
pnpm analisis              # solo el cuaderno, sobre fixtures/sinteticas
pnpm analisis:test         # pruebas de Python (incluye dos ejecuciones del cuaderno)
```

Sobre una corrida real:

```bash
cd experiment
uv run papermill analisis.ipynb salidas/analisis.ejecutado.ipynb --cwd . \
  -p directorio_corrida ../runs/2026-10-14-oficial
```

## Contenido

| Ruta                                               | Contenido                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`metricas.yaml`](metricas.yaml)                   | Registro unico de las 43 metricas: ficha del plan, campo fuente, rol, umbral o resultado abierto.   |
| [`schemas/`](schemas)                              | `traza`, `metricas`, `insumos` y `resultados` (JSON Schema 2020-12) y ejemplos compartidos con AJV. |
| [`analisis/registro.py`](analisis/registro.py)     | Carga y valida el registro; unica fuente de nombres de campo.                                       |
| [`analisis/carga.py`](analisis/carga.py)           | Lee trazas JSONL y cuarentena, valida, rechaza y consolida a Parquet.                               |
| [`analisis/inferencia.py`](analisis/inferencia.py) | Bootstrap pareado por conglomerados: remuestrea tareas, nunca ejecuciones.                          |
| [`analisis/familias/`](analisis/familias)          | `m1_efectividad.py`, `m4_eficiencia.py`, `m7_fiabilidad.py` y piezas comunes.                       |
| [`analisis/salida.py`](analisis/salida.py)         | `resultados.json`, tablas y figuras etiquetadas, manifiesto.                                        |
| [`analisis.ipynb`](analisis.ipynb)                 | El cuaderno unico: corre de principio a fin con papermill.                                          |
| [`fixtures/generador.py`](fixtures/generador.py)   | Corrida sintetica con casos borde deliberados.                                                      |
| [`pruebas/`](pruebas)                              | pytest.                                                                                             |
| `salidas/`                                         | Salidas del cuaderno. **No se versionan**.                                                          |
| `ejecutor/`, `juez/`                               | Reservadas para el ejecutor y el juez (aun vacias).                                                 |
| `trazas/`, `resultados/`                           | Artefactos de corridas. **No se versionan**.                                                        |

**Lo que NO contiene:** logica de triaje ni codigo TypeScript. La validacion de trazas
antes de persistir vive en [`libs/trazas`](../libs/trazas).

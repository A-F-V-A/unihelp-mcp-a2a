# experiment/

Sistema de metricas del experimento y **ejecutor** del conjunto de 40 tareas. Es la
**unica parte del repositorio autorizada a calcular una metrica** (decision 19): el
backend produce trazas, este directorio las valida y calcula, y el panel web solo
leera `salidas/resultados.json`. El ejecutor tampoco calcula metricas: produce
trazas y puntuaciones.

Detalle del diseno, puntos de rechazo y contrato de resultados:
[`docs/sistema-de-metricas.md`](../docs/sistema-de-metricas.md).

## Correr las 40 tareas contra una arquitectura

Requiere [uv](https://docs.astral.sh/uv/) y la arquitectura levantada con
`UNIHELP_PERFIL=experimento` (sin ese perfil las rutas del ejecutor son 404,
decision 32). Hoy **solo B0 esta implementada**.

```bash
pnpm conocimiento:db                    # PostgreSQL
pnpm conocimiento:migrar && pnpm tickets:migrar
pnpm dev:b0                             # B0 en :3000, con .env de experimento

pnpm ejecutor:validar                   # revisa las 40 tareas sin ejecutar
pnpm ejecutor:salud                     # comprueba que el backend responde
pnpm ejecutor:correr                    # corre la matriz de corrida.yaml
```

Opciones de `correr` (tambien en `validar` y `salud`):

```bash
cd experiment
uv run python -m ejecutor correr --tareas T-COM-001,T-ADV-*   # subconjunto
uv run python -m ejecutor correr --repeticiones 5 --modo-llm replay
uv run python -m ejecutor verificar corridas/<nombre>          # revisa una corrida
uv run python -m ejecutor huellas                              # regenera las huellas
```

Cada corrida deja su propio directorio en `corridas/<nombre>/`:

| Archivo                   | Contenido                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `trazas.jsonl`            | Una traza valida por linea. Es la entrada del cuaderno.                |
| `puntuaciones.jsonl`      | Compuerta automatica por ejecucion, con el motivo de cada rechazo.     |
| `huellas-esperadas.json`  | Huella de estado inicial por tarea, para el rechazo de M7.2.           |
| `manifiesto.json`         | Version del codigo, `config_hash`, conteos y si la tarifa esta fijada. |
| `cuarentena/trazas.jsonl` | Las que no validaron, con sus errores. NO entran al conjunto.          |
| `reejecuciones.md`        | Fallos de infraestructura a reejecutar (RM-15). Solo si los hubo.      |

## Ejecutar el analisis

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
| [`ejecutor/corrida.yaml`](ejecutor/corrida.yaml)   | Configuracion de la corrida: semilla, repeticiones, backends, tarifa. Va a `config_hash`.           |
| [`ejecutor/tareas.py`](ejecutor/tareas.py)         | Carga las 40 tareas y decide el corpus de cada una.                                                 |
| [`ejecutor/cliente.py`](ejecutor/cliente.py)       | Cliente HTTP unico para las cuatro arquitecturas.                                                   |
| [`ejecutor/corrida.py`](ejecutor/corrida.py)       | El ciclo de una ejecucion y la matriz aleatorizada con semilla.                                     |
| [`ejecutor/traza.py`](ejecutor/traza.py)           | Arma la traza y la valida antes de persistirla (HU-38).                                             |
| [`ejecutor/compuerta.py`](ejecutor/compuerta.py)   | Compuerta automatica de la rubrica: las ocho verificaciones de docs/04 (HU-40).                     |
| [`ejecutor/cli.py`](ejecutor/cli.py)               | `validar`, `huellas`, `salud`, `correr`, `verificar`.                                               |
| [`pruebas/`](pruebas)                              | pytest.                                                                                             |
| `salidas/`                                         | Salidas del cuaderno. **No se versionan**.                                                          |
| `corridas/`                                        | Artefactos de cada corrida del ejecutor. **No se versionan**.                                       |
| `casetes/`                                         | Grabaciones del modelo en modo `record` (HU-39). **No se versionan**.                               |
| `juez/`                                            | Reservada para el juez LLM (aun vacia): sin el, `veredicto_juez` es `null`.                         |
| `trazas/`, `resultados/`                           | Artefactos de corridas. **No se versionan**.                                                        |

**Lo que NO contiene:** logica de triaje ni codigo TypeScript. La validacion de trazas
antes de persistir vive en [`libs/trazas`](../libs/trazas).

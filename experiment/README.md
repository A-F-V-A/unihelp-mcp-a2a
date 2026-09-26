# experiment/

Sistema de metricas del experimento y **ejecutor** del conjunto de 40 tareas. Es la
**unica parte del repositorio autorizada a calcular una metrica** (decision 19): el
backend produce trazas, este directorio las valida y calcula, y el panel web solo
leera `salidas/resultados.json`. El ejecutor tampoco calcula metricas: produce
trazas y puntuaciones.

Detalle del diseno, puntos de rechazo y contrato de resultados:
[`docs/sistema-de-metricas.md`](../docs/sistema-de-metricas.md).

## Correr las 40 tareas contra una arquitectura

Tambien se puede correr desde el panel web (`http://localhost:4200/experimento`,
pestaña _Correr una corrida_) con la consola levantada (`pnpm dev:consola`):
lanza exactamente estos mismos comandos y muestra el progreso (decision 39).

Requiere [uv](https://docs.astral.sh/uv/) y la arquitectura levantada con
`UNIHELP_PERFIL=experimento` (sin ese perfil las rutas del ejecutor son 404,
decision 32). Las cuatro arquitecturas estan implementadas; B2 y B3 necesitan
`mcp-server` levantado y B3 sus dos especialistas.

```bash
pnpm conocimiento:db                    # PostgreSQL
pnpm conocimiento:migrar && pnpm tickets:migrar
pnpm dev:b0                             # B0 en :3000, con .env de experimento
pnpm dev:b1                             # mcp-server en :3010 + B1 en :3001 (ambos con su .env; B1 con UNIHELP_PERFIL=experimento)

pnpm ejecutor:validar                   # revisa las 40 tareas sin ejecutar
pnpm ejecutor:salud                     # comprueba que el backend responde
pnpm ejecutor:correr                    # corre la matriz de corrida.yaml (arquitecturas: [B0])
pnpm ejecutor:correr -- --arquitecturas B1        # solo B1
pnpm ejecutor:correr -- --arquitecturas B0,B1     # B0 y B1 en la MISMA corrida: es lo que H1 necesita
pnpm dev:b2                             # mcp-server en :3010 + B2 en :3002 (B2 con UNIHELP_PERFIL=experimento)
pnpm dev:b3                             # mcp-server + especialistas (:3004, :3005) + orquestador en :3003
pnpm ejecutor:correr -- --arquitecturas B2,B3     # B2 y B3 en la MISMA corrida: contraste B3-B2 (H3)
pnpm ejecutor:correr -- --arquitecturas B0,B1,B2,B3   # las cuatro (pnpm dev:panel:todas las levanta)
```

**Para comparar B0 con B1** (contraste `B1-B0` de `metricas.yaml`, H1) las dos
arquitecturas deben ir en la misma corrida: el cuaderno remuestrea tareas
completas y calcula la diferencia dentro de cada tarea, asi que necesita ambas
columnas en el mismo `trazas.jsonl`, con el mismo `config_hash`. Dos corridas
separadas (una de B0 y otra de B1) no se combinan; hacerlo seria una decision
de medicion pendiente (RM-17). Los dos backends deben usar el mismo modelo, el
mismo modo de casetes y el mismo limite de llamadas (RNF-01): en B1 el limite
lo aplica `mcp-server` (`apps/mcp-server/.env`). Con una sola arquitectura en
la corrida, los contrastes salen `sin_datos` y las metricas por arquitectura se
calculan igual.

**Campañas de varios modelos** (`experiment/campana.py`): corre las cuatro
arquitecturas con cada modelo en su propio entorno aislado (base `unihelp_cN`,
`mcp-server` y siete backends en puertos `3N00..3N10`), todas las campañas a la
vez, y al final ejecuta el cuaderno sobre cada corrida y copia los artefactos a
`resultados/`. Dentro de cada campaña la matriz sigue en serie (RM-04); lo que
las campañas comparten es la maquina, asi que comparar latencias ENTRE modelos
corridos a la vez es una decision de medicion aparte (RM-17).

```bash
# una base por campaña, migrada y sembrada (SWC_NODE_PROJECT lo pone nx en los targets)
docker exec unihelp-postgres psql -U unihelp -d unihelp -c "CREATE DATABASE unihelp_c1;"
CONOCIMIENTO_DATABASE_URL=postgres://unihelp:unihelp@localhost:5432/unihelp_c1 TICKETS_DATABASE_URL=... pnpm conocimiento:preparar && pnpm tickets:migrar
pnpm nx run-many -t build --projects=mcp-server,b0-directo,b1-mcp-agente,b2-multiagente-local,b3-a2a-orquestador,b3-a2a-conocimiento,b3-a2a-diagnostico
cd experiment && uv run python campana.py --modelos gpt-5.5-2026-04-23,gpt-5.4-2026-03-05 --repeticiones 3
# con el modelo local de Ollama (decision 46): sin clave, una campaña a la vez (una sola GPU)
cd experiment && uv run python campana.py --proveedor ollama --modelos unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k --repeticiones 1
```

`ejecutor correr --corrida <archivo>` acepta otro archivo de corrida (es lo
que usa la campaña para apuntar a sus backends).

Para **ver** las tareas correr en el navegador, con una persona simulada que teclea y
un panel con tokens, latencia y herramientas: [`visor/`](visor/README.md)
(`pnpm visor`, `pnpm visor:ui`). El visor no calcula metricas: le pide el veredicto
de la compuerta a `python -m ejecutor puntuar-observacion` y sus observaciones se
convierten en una corrida con `python -m ejecutor importar-visor`.

Opciones de `correr` (tambien en `validar` y `salud`):

```bash
cd experiment
uv run python -m ejecutor correr --tareas T-COM-001,T-ADV-*   # subconjunto
uv run python -m ejecutor correr --repeticiones 5 --modo-llm replay
uv run python -m ejecutor verificar corridas/<nombre>          # revisa una corrida
uv run python -m ejecutor huellas                              # regenera las huellas
uv run python -m ejecutor indice                               # reescribe corridas/indice.json (lo lee el panel web)
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

Ademas, `corridas/indice.json` cataloga todas las corridas (nombre, manifiesto y
archivos) para el panel web de `apps/web` (`/experimento`), que lee archivos
estaticos y no puede listar un directorio (decision 38). Se reescribe al terminar
cada corrida y a mano con `ejecutor indice`.

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

| Ruta                                                     | Contenido                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`metricas.yaml`](metricas.yaml)                         | Registro unico de las 43 metricas: ficha del plan, campo fuente, rol, umbral o resultado abierto.         |
| [`schemas/`](schemas)                                    | `traza`, `metricas`, `insumos` y `resultados` (JSON Schema 2020-12) y ejemplos compartidos con AJV.       |
| [`analisis/registro.py`](analisis/registro.py)           | Carga y valida el registro; unica fuente de nombres de campo.                                             |
| [`analisis/carga.py`](analisis/carga.py)                 | Lee trazas JSONL y cuarentena, valida, rechaza y consolida a Parquet.                                     |
| [`analisis/inferencia.py`](analisis/inferencia.py)       | Bootstrap pareado por conglomerados: remuestrea tareas, nunca ejecuciones.                                |
| [`analisis/familias/`](analisis/familias)                | `m1_efectividad.py`, `m4_eficiencia.py`, `m7_fiabilidad.py` y piezas comunes.                             |
| [`analisis/salida.py`](analisis/salida.py)               | `resultados.json`, tablas y figuras etiquetadas, manifiesto.                                              |
| [`analisis.ipynb`](analisis.ipynb)                       | El cuaderno unico: corre de principio a fin con papermill.                                                |
| [`fixtures/generador.py`](fixtures/generador.py)         | Corrida sintetica con casos borde deliberados.                                                            |
| [`ejecutor/corrida.yaml`](ejecutor/corrida.yaml)         | Configuracion de la corrida: semilla, repeticiones, backends, tarifa. Va a `config_hash`.                 |
| [`ejecutor/tareas.py`](ejecutor/tareas.py)               | Carga las 40 tareas y decide el corpus de cada una.                                                       |
| [`ejecutor/cliente.py`](ejecutor/cliente.py)             | Cliente HTTP unico para las cuatro arquitecturas.                                                         |
| [`ejecutor/corrida.py`](ejecutor/corrida.py)             | El ciclo de una ejecucion y la matriz aleatorizada con semilla.                                           |
| [`ejecutor/traza.py`](ejecutor/traza.py)                 | Arma la traza y la valida antes de persistirla (HU-38).                                                   |
| [`ejecutor/compuerta.py`](ejecutor/compuerta.py)         | Compuerta automatica de la rubrica: las ocho verificaciones de docs/04 (HU-40).                           |
| [`ejecutor/observaciones.py`](ejecutor/observaciones.py) | Convierte lo que observo el visor en trazas y puntuaciones, con el mismo armado y compuerta.              |
| [`ejecutor/cli.py`](ejecutor/cli.py)                     | `validar`, `huellas`, `salud`, `correr`, `puntuar`, `verificar`, `puntuar-observacion`, `importar-visor`. |
| [`visor/`](visor/README.md)                              | Playwright: las tareas en vivo en el navegador, con panel de tokens y latencia.                           |
| [`pruebas/`](pruebas)                                    | pytest.                                                                                                   |
| `salidas/`                                               | Salidas del cuaderno. **No se versionan**.                                                                |
| `corridas/`                                              | Artefactos de cada corrida del ejecutor. **No se versionan**.                                             |
| `casetes/`                                               | Grabaciones del modelo en modo `record` (HU-39). **No se versionan**.                                     |
| `juez/`                                                  | Reservada para el juez LLM (aun vacia): sin el, `veredicto_juez` es `null`.                               |
| `trazas/`, `resultados/`                                 | Artefactos de corridas. **No se versionan**.                                                              |

**Lo que NO contiene:** logica de triaje ni codigo TypeScript. La validacion de trazas
antes de persistir vive en [`libs/trazas`](../libs/trazas).

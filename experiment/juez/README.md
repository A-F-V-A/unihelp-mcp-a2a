# Juez de calidad (compuerta 2)

El juez califica la **respuesta en lenguaje natural** de cada ejecucion con la
rubrica de su tarea (puntos clave, prohibiciones y abstencion) y alimenta M3.2,
M3.3, M3.4, M7.5 y el `exito` de M1 (docs/04, compuerta 2). Lo hace Claude en
una sesion del proyecto con la carpeta del repositorio conectada, sin costo de
API (decision 52).

| Archivo | Que es | Se versiona |
| --- | --- | --- |
| [`prompt-v2.md`](prompt-v2.md) | **Vigente.** Instrucciones del juez: ceguera, rubrica, `puntos_sin_respaldo`, formato y procedimiento por lotes sin preguntas | si |
| [`prompt-v1.md`](prompt-v1.md) | Primera version (mismo criterio de veredicto, sin `puntos_sin_respaldo`) | si |
| [`preparar_lotes.py`](preparar_lotes.py) | Arma los lotes ciegos desde `resultados/` (sin arquitectura, modelo ni `traceId`) | si |
| [`incorporar.py`](incorporar.py) | Valida los veredictos, deshace el cegado y actualiza las corridas completas | si |
| `lotes/lote-NNN.jsonl` | 20 ejecuciones por lote, una corrida por bloque de lotes | no (se regenera igual con la semilla) |
| `clave-ciega.json` | Identificador ciego -> corrida y `run_id`. **El juez no la abre** | no |
| [`preparar_muestra_humana.py`](preparar_muestra_humana.py) | Muestra ciega de 160 ejecuciones para la revision humana (M7.4, M7.5) | si |
| [`incorporar_humana.py`](incorporar_humana.py) | Con la revision completa, escribe `calificacion-humana.jsonl` en cada corrida | si |
| `revision-humana/muestra.json` | La muestra ciega (`MuestraRevisionDto`), lo que sirve la consola | si |
| `revision-humana/clave-muestra.json` | Id -> corrida, `run_id`, tarea, arquitectura y modelo. **Los revisores no la abren** | no |
| `revision-humana/calificaciones-{A,B}.jsonl`, `adjudicaciones.jsonl` | Lo que guardan los revisores desde el panel | si |
| `veredictos/lote-NNN.jsonl` | Lo que escribe el juez v2, con su justificacion | si |
| `veredictos-v1/lote-001..024.jsonl` | Primera pasada (v1) sobre gpt-5.5: sirve para medir la consistencia del juez | si |

## Flujo

```bash
cd experiment
uv run python juez/preparar_lotes.py          # 1. lotes ciegos (3302 ejecuciones, 167 lotes)
# 2. sesion(es) de Claude con prompt-v2.md: escriben juez/veredictos/lote-NNN.jsonl
uv run python juez/incorporar.py --juez "claude-opus-5-5 (sesion Claude, proyecto AFVA)" --prompt prompt-v2.md
# 3. volver a correr el cuaderno sobre las corridas incorporadas
```

`incorporar.py` solo toca una corrida cuando TODAS sus ejecuciones tienen
veredicto valido. Entonces escribe `veredictos-juez.jsonl` y `juez.json` en su
carpeta de `resultados/` y actualiza `puntuaciones.jsonl` con
`exito = compuerta_automatica AND veredicto == aprobado`: el juez solo puede
quitar exito (RM-16).

## Lotes por corrida

| Lotes | Corrida |
| --- | --- |
| 1-24 | gpt-5.5 (480) |
| 25-48 | gpt-5.4 (480) |
| 49-72 | gpt-5.4-mini (480) |
| 73-96 | gpt-4.1-mini (480) |
| 97-120 | Qwen2.5 7B (480) |
| 121-138 | gemini-3.1-flash-lite, 26 sep (348) |
| 139-146 | gpt-5.5, corrida conjunta de 1 repeticion (160) |
| 147-165 | Gemini parciales del 25 sep (354) |
| 166-167 | Qwen2.5 7B solo B0 (40) |

Varias sesiones pueden trabajar a la vez si cada una toma un rango distinto.

**No regenerar los lotes con un juicio en curso**: si cambia el contenido de
`resultados/`, la numeracion de lotes y la clave cambian y los veredictos ya
escritos dejarian de corresponder.

## Revision humana (M7.4, M7.5; docs/04, capa 3)

Dos personas (A y B) califican a ciegas, con la misma rubrica del juez, una
muestra estratificada de 160 ejecuciones: 4 categorias de tarea x 4
arquitecturas x 10, repartidas entre los seis modelos de las campanas `-r3`
(26 o 27 por modelo) y con tareas distintas dentro de cada celda (semilla
20261015). La calificacion se hace en el panel (`/experimento/revision`) contra
la consola del experimento (`/revision/*`).

```bash
cd experiment
uv run python juez/preparar_muestra_humana.py   # 1. muestra.json y clave-muestra.json
pnpm dev:consola && pnpm dev:web                # 2. A y B califican en /experimento/revision; luego se adjudican los desacuerdos
uv run python juez/incorporar_humana.py         # 3. calificacion-humana.jsonl en cada corrida
```

`incorporar_humana.py` no escribe nada mientras falte una calificacion o un
desacuerdo sin adjudicar, y lo dice. **No regenerar la muestra con la revision
en curso**: los `R-NNN` dejarian de corresponder a lo calificado.

## Limites conocidos

- La temperatura de la sesion no se controla (el plan pide 0): el juez puede no
  ser determinista. Se compensa con la validacion humana (M7.5).
- En 32 respuestas de T-ADV-007 el propio agente menciona «el especialista», lo
  que delata el multiagente. Es el texto que se califica y no se altera.

## Hallazgo de la primera pasada (v1, gpt-5.5)

El juez aprobo 218 de 480 y quito el exito a 237 ejecuciones que pasaban la
compuerta. La causa principal no es el agente: `buscar_politica` devuelve **un
solo extracto por politica** (el que mejor coincide) y ninguna herramienta
devuelve la politica completa, mientras que los puntos clave de las tareas
informativas piden los otros extractos (por ejemplo, POL-AU-002: "desbloqueo
automatico a los 30 minutos"). Afecta igual a B0-B3. Por eso la v2 marca
`puntos_sin_respaldo` sin cambiar el veredicto (decision 53).

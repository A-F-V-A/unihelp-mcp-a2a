# Juez de calidad (compuerta 2)

El juez califica la **respuesta en lenguaje natural** de cada ejecucion con la
rubrica de su tarea (puntos clave, prohibiciones y abstencion) y alimenta M3.2,
M3.3, M3.4, M7.5 y el `exito` de M1 (docs/04, compuerta 2). Lo hace Claude en
una sesion del proyecto con la carpeta del repositorio conectada, sin costo de
API (decision 52).

| Archivo | Que es | Se versiona |
| --- | --- | --- |
| [`prompt-v1.md`](prompt-v1.md) | Instrucciones completas del juez: reglas de ceguera, rubrica, formato de salida y procedimiento por lotes | si |
| [`preparar_lotes.py`](preparar_lotes.py) | Arma los lotes ciegos desde `resultados/` (sin arquitectura, modelo ni `traceId`) | si |
| [`incorporar.py`](incorporar.py) | Valida los veredictos, deshace el cegado y actualiza las corridas completas | si |
| `lotes/lote-NNN.jsonl` | 20 ejecuciones por lote, una corrida por bloque de lotes | no (se regenera igual con la semilla) |
| `clave-ciega.json` | Identificador ciego -> corrida y `run_id`. **El juez no la abre** | no |
| `veredictos/lote-NNN.jsonl` | Lo que escribe el juez, con su justificacion | si |

## Flujo

```bash
cd experiment
uv run python juez/preparar_lotes.py          # 1. lotes ciegos (3302 ejecuciones, 167 lotes)
# 2. sesion(es) de Claude con prompt-v1.md: escriben juez/veredictos/lote-NNN.jsonl
uv run python juez/incorporar.py --juez "claude-opus-5-5 (sesion Claude, proyecto AFVA)"
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

## Limites conocidos

- La temperatura de la sesion no se controla (el plan pide 0): el juez puede no
  ser determinista. Se compensa con la validacion humana (M7.5).
- En 32 respuestas de T-ADV-007 el propio agente menciona «el especialista», lo
  que delata el multiagente. Es el texto que se califica y no se altera.

# Resultados archivados del experimento

Aqui se **versionan** los datos crudos de cada corrida que el equipo decidio
conservar (decision 47): las trazas de cada ejecucion, el veredicto de la
compuerta, el manifiesto con la procedencia (modelo, commit, semilla) y la
salida del cuaderno de metricas. Es el registro de evidencia del trabajo de
grado: cualquier cifra de un informe se puede rehacer desde estos archivos.

Las carpetas `experiment/corridas/` y `experiment/salidas/` siguen sin
versionarse: son el area de trabajo del ejecutor y del cuaderno. Lo que vale la
pena conservar se copia aqui con el nombre `<fecha>-<nombre de la corrida>`
(`campana.py` lo hace solo; a mano, ver el final de este documento).

El indice de carpetas, con el modelo y los conteos de cada una, esta en
[`indice.md`](indice.md) (se regenera con `uv run python resultados/indice.py`).

## Que hay en cada carpeta

| Archivo                                                        | Origen   | Contenido                                                                                                                                                                                                |
| -------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifiesto.json`                                              | ejecutor | Procedencia de la corrida: commit (`version_codigo`), `config_hash`, semilla, modo del modelo, arquitecturas, repeticiones, ejecuciones, trazas validas, en cuarentena y cuantas superaron la compuerta. |
| `trazas.jsonl`                                                 | ejecutor | **Una linea JSON por ejecucion** (tarea x arquitectura x repeticion), validada contra `experiment/schemas/traza.schema.json`. Es el dato crudo principal.                                                |
| `puntuaciones.jsonl`                                           | ejecutor | Una linea por ejecucion con `exito` (compuerta automatica) y `motivos` cuando no la supera.                                                                                                              |
| `huellas-esperadas.json`                                       | ejecutor | Huella del estado inicial esperada por variante; la de cada traza debe coincidir (M7.2).                                                                                                                 |
| `resultados.json`                                              | cuaderno | Todas las metricas calculadas: filas por arquitectura (y categoria o componente) con su intervalo, y los contrastes entre arquitecturas. Es lo que lee el panel.                                         |
| `manifiesto-cuaderno.json`                                     | cuaderno | Con que version del registro de metricas y del esquema se calculo.                                                                                                                                       |
| `tabla_1.csv` … `tabla_7.csv`, `figura_1.svg` … `figura_4.svg` | cuaderno | Las tablas y figuras del plan de medicion (docs/09).                                                                                                                                                     |
| `cuarentena/` (si existe)                                      | ejecutor | Trazas que no validaron, con el motivo; no entran en las metricas.                                                                                                                                       |

Cada traza (`trazas.jsonl`) trae, entre otros, estos campos:

| Campo                                                      | Que es                                                                                                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run_id`, `trace_id`, `task_id`, `condition`, `repetition` | Identidad de la ejecucion: tarea (`T-INF-001`…), arquitectura (`B0`…`B3`), repeticion.                                                                                                             |
| `provenance`                                               | `modelo_id` exacto, `version_codigo`, `semilla`, `config_hash`, `llm_mode`, `state_hash_inicial`. **Aqui esta el modelo de cada ejecucion.**                                                       |
| `timing.total_ms` y `timing.breakdown`                     | Latencia total y su descomposicion: `llm_ms`, `tool_exec_ms`, `transport_ms`, `orchestration_ms` (reloj monotono).                                                                                 |
| `usage`                                                    | `input_tokens`, `output_tokens`, `cached_input_tokens`, `llm_calls`, `cost_usd_est`, sumados entre todos los agentes de la ejecucion.                                                              |
| `tool_calls[]`                                             | Cada herramienta invocada, en orden: `nombre`, `args`, `resultado`, `latency_ms`, `isError`, `agente` (quien la hizo) y `transporte` (`directo`, `mcp`, `en-proceso`, `a2a`).                      |
| `a2a`                                                      | `mensajes_totales`, `task_id`, `estados[]` (ciclo de vida de la tarea) y `hops[]` (cada delegacion con `rtt_ms`, `procesamiento_receptor_ms`, `transport_ms`). `{mensajes_totales: 0}` en B0 y B1. |
| `conversation[]`                                           | Los turnos literales de la persona y del agente.                                                                                                                                                   |
| `outcome`                                                  | `status` (`ok`, `timeout`, …), `final_answer`, `final_json` (el objeto `resultado_triaje`), `confirmacion_solicitada`, `tickets_creados`.                                                          |
| `server_audit[]`                                           | Eventos de auditoria del servidor para esa traza.                                                                                                                                                  |

## Como analizar estos datos

**Regla previa (RM-02):** toda metrica del estudio se calcula en el cuaderno
[`../analisis.ipynb`](../analisis.ipynb), que lee `trazas.jsonl` y
`puntuaciones.jsonl` y escribe `resultados.json`. Explorar los datos crudos a
mano esta bien para entender un fallo o cruzar informacion; una cifra que va a
un informe sale del cuaderno.

### 1. Volver a calcular las metricas de una carpeta

```bash
cd experiment
uv run papermill analisis.ipynb salidas/analisis.<nombre>.ipynb --cwd . \
  -p directorio_corrida resultados/<carpeta> -p directorio_salidas salidas/<nombre>
```

Produce el mismo `resultados.json` (salvo `generado_en`) si el codigo y el
registro de metricas no cambiaron. Para comparar arquitecturas, las que se
comparan deben estar en la MISMA carpeta (mismo `trazas.jsonl`): el cuaderno
hace bootstrap pareado por tarea y no combina corridas distintas.

### 2. Leer las trazas con pandas

```python
import json, pandas as pd
trazas = [json.loads(l) for l in open('resultados/<carpeta>/trazas.jsonl', encoding='utf-8')]
df = pd.json_normalize(trazas)
df[['task_id', 'condition', 'repetition', 'provenance.modelo_id',
    'timing.total_ms', 'timing.breakdown.llm_ms', 'timing.breakdown.transport_ms',
    'usage.input_tokens', 'usage.output_tokens', 'usage.llm_calls', 'a2a.mensajes_totales',
    'outcome.status']].head()
```

Ejemplos utiles:

- Latencia mediana por arquitectura: `df.groupby('condition')['timing.total_ms'].median()`.
- Tokens por tarea y arquitectura: `df.pivot_table(index='task_id', columns='condition', values='usage.input_tokens', aggfunc='median')`.
- Llamadas a herramientas de una ejecucion: `pd.DataFrame(trazas[0]['tool_calls'])`.
- Saltos entre agentes en B2/B3: `pd.DataFrame(t['a2a']['hops'])` para cada traza con `condition in ('B2', 'B3')`.

### 3. Cruzar con la compuerta

```python
punt = pd.read_json('resultados/<carpeta>/puntuaciones.jsonl', lines=True)
punt[['task_id', 'condition']] = punt['run_id'].str.split('|', expand=True)[[0, 1]]
punt.groupby('condition')['exito'].mean()                   # tasa de exito cruda
punt[~punt['exito']].explode('motivos')['motivos'].value_counts()   # por que fallan
```

Los motivos (`falta_politica_requerida:POL-…`, `herramienta_prohibida:…`,
`cifra_no_recuperada:…`, `politica_prohibida:…`, `falta_herramienta_obligatoria`,
`tickets_creados`, `ticket_categoria`) corresponden a las verificaciones de
docs/04, seccion 4. `motivos` vacio y `exito: true` es una ejecucion aprobada.

### 4. Leer `resultados.json`

```python
r = json.load(open('resultados/<carpeta>/resultados.json', encoding='utf-8'))
m = next(x for x in r['metricas'] if x['codigo'] == 'M4.1')
pd.DataFrame(m['filas'])        # valor e intervalo por arquitectura
pd.DataFrame(m['contrastes'])   # B1-B0, B2-B1, B3-B2, B3-B1 con su intervalo
```

`estado` de cada metrica dice si se calculo (`calculada`), si falta un insumo
(`sin_datos`, con `motivo_estado`) o si aun no esta implementada (`pendiente`).
Los intervalos son bootstrap pareado por tarea al 95 % (n = 40 tareas); se
leen como estimacion e intervalo, no como aprobado/reprobado (RM-14).

### 5. Comparar modelos

Cada campaña de un modelo es una carpeta. Para poner modelos lado a lado se
leen los `resultados.json` de cada carpeta y se juntan por metrica y
arquitectura; los contrastes entre arquitecturas son validos dentro de cada
modelo. Comparar latencias absolutas entre modelos que corrieron a la vez en la
misma maquina es una decision de medicion aparte (RM-17); efectividad, tokens
y numero de llamadas si son comparables. Ejemplo en
`docs/resultados-2026-09-25-campana-modelos.md`.

## Como archivar una corrida a mano

```bash
cd experiment
d=resultados/$(date +%F)-<nombre>; mkdir -p $d
cp corridas/<nombre>/{manifiesto.json,trazas.jsonl,puntuaciones.jsonl,huellas-esperadas.json} $d/
cp salidas/<nombre>/{resultados.json,tabla_*.csv,figura_*.svg} $d/
cp salidas/<nombre>/manifiesto.json $d/manifiesto-cuaderno.json
uv run python resultados/indice.py
```

Los archivos pueden traer el texto literal de las conversaciones de las
tareas: son datos sinteticos (RNF-05), nunca de personas reales.

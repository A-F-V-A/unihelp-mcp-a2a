# Runner, esquema de trazas, métricas y plan de análisis

El runner es el componente más subestimado del plan original: aparece en la semana 7 y de él
depende que existan resultados. Aquí se especifica para construirlo en las semanas 2–3.

## 1. CLI

```bash
unihelp-eval run \
  --config      experiment.config.yaml \
  --conditions  B0,B1,B2,B3 \
  --tasks       all \
  --repetitions 5 \
  --seed        20261014 \
  --out         runs/2026-10-14-oficial \
  --concurrency 4 \
  --llm-mode    record            # record | replay | live
```

Subcomandos:

| Comando | Función |
|---|---|
| `run` | Ejecuta la matriz completa |
| `validate` | Valida los 40 YAML contra el esquema, sin ejecutar |
| `resume <run_dir>` | Reanuda una corrida interrumpida (idempotente por `run_id`) |
| `score <run_dir>` | Aplica compuerta 1 + juez y produce `scores.parquet` |
| `report <run_dir>` | Genera tablas y figuras |
| `bench-transport` | Microbenchmark de transporte (B-5 de la revisión) |
| `verify <run_dir>` | Comprueba integridad: esquema, completitud, `state_hash` |

## 2. Ciclo de una ejecución

```
para cada (tarea, condición, repetición)  ← orden aleatorizado con semilla
  1. POST /api/v1/admin/reset  { overlay: tarea.estado_inicial.overlay }
     └─ recibe state_hash → si difiere del esperado para esa tarea, ABORTA la ejecución
  2. genera run_id  y  trace_id
  3. arranca cronómetro; envía el primer turno del usuario
  4. bucle de agente hasta: respuesta final | max_turnos | timeout | LIMITE_EXCEDIDO
     └─ si el agente pide confirmación y la tarea tiene un turno con
        condicion_de_envio: agente_pidio_confirmacion → se envía ese turno
  5. recolecta: mensajes, tool calls, saltos A2A, usage de tokens
  6. GET /api/v1/audit?trace_id=...  → eventos del lado servidor
  7. arma el objeto de traza, VALIDA contra trace.schema.json
     └─ si no valida: escribe en invalid/ y marca la ejecución como fallida
  8. persiste una línea en runs/<dir>/traces.jsonl  (append, con fsync)
```

**El paso 7 es innegociable.** El riesgo "resultados incompletos" del plan original se elimina
validando antes de persistir, no auditando al final.

## 3. Esquema de traza (`evaluation/schemas/trace.schema.json`)

```json
{
  "run_id": "T-COM-004|B3|r3|20261014T031102Z",
  "task_id": "T-COM-004",
  "condition": "B3",
  "repetition": 3,
  "seed": 20261014,
  "trace_id": "run-...-T-COM-004-B3-r3",

  "provenance": {
    "git_sha": "9f2c1ab",
    "config_hash": "sha256:...",
    "dataset_version": "1.0",
    "prompt_hash": "sha256:...",
    "state_hash_inicial": "sha256:...",
    "docker_images": { "unihelp-api": "sha256:...", "mcp-server": "sha256:..." },
    "llm_mode": "record",
    "cassette_path": "cassettes/B3/T-COM-004-r3.json"
  },

  "model": {
    "provider": "anthropic",
    "id": "claude-...",
    "snapshot": "<id exacto con fecha>",
    "temperature": 0.2, "top_p": 1.0, "max_tokens": 2048,
    "judge_model": null
  },

  "timing": {
    "started_at": "2026-10-14T03:11:02.113Z",
    "ended_at":   "2026-10-14T03:11:19.884Z",
    "total_ms": 17771,
    "breakdown": { "llm_ms": 14210, "tool_exec_ms": 1980, "transport_ms": 412, "orchestration_ms": 1169 }
  },

  "usage": {
    "input_tokens": 9134, "output_tokens": 1207, "cached_input_tokens": 4096,
    "llm_calls": 6, "cost_usd_est": 0.0412
  },

  "conversation": [ { "turno": 1, "rol": "usuario", "texto": "..." } ],

  "tool_calls": [
    { "seq": 1, "agente": "knowledge-agent", "nombre": "buscar_politica",
      "args": {"consulta":"prórroga entrega aula virtual","servicio":"aula_virtual"},
      "transporte": "mcp-streamable-http",
      "resultado_status": "ok", "resultado_resumen": {"codigos":["POL-AV-007"]},
      "latency_ms": 143, "isError": false }
  ],

  "a2a": {
    "task_id": "...",
    "estados": [ {"estado":"submitted","t":"..."}, {"estado":"input-required","t":"..."} ],
    "hops": [ { "n":1, "de":"orchestrator", "a":"knowledge-agent",
                "t_emision":"...", "t_recepcion":"...",
                "procesamiento_receptor_ms": 2210, "transport_ms": 38 } ],
    "mensajes_totales": 6,
    "artefactos": ["politica_aplicable","diagnostico","resultado_triaje"]
  },

  "server_audit": [
    { "accion":"policy.search","resultado":"OK" },
    { "accion":"ticket.create","resultado":"OK","ticket_id":"UNI-2026-000124" }
  ],

  "outcome": {
    "final_answer": "...",
    "final_json": { "clasificacion":"compuesta", "...": "..." },
    "tickets_creados": ["UNI-2026-000124"],
    "confirmacion_solicitada": true,
    "confirmacion_otorgada": true,
    "rechazos_servidor": [],
    "status": "ok"
  },

  "errors": []
}
```

`status` ∈ `{ok, timeout, limite_herramientas, error_infraestructura, error_agente, esquema_invalido}`.

**Regla de análisis:** `error_infraestructura` se **reejecuta** (y se registra la reejecución en
`runs/<dir>/reruns.md`); todo lo demás cuenta como fallo de la condición. Confundir estas dos
cosas es la forma más común de inflar resultados sin darse cuenta.

## 4. Capa de casetes (record/replay)

```python
# evaluation/runner/llm_cassette.py
def clave(peticion) -> str:
    canon = json.dumps({
        "model": peticion["model"],
        "messages": peticion["messages"],
        "tools": sorted(t["name"] for t in peticion.get("tools", [])),
        "temperature": peticion.get("temperature"),
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canon.encode()).hexdigest()
```

- `live`: llama al proveedor, no guarda.
- `record`: llama y guarda `{clave: respuesta}` en el casete de la ejecución.
- `replay`: solo lee. Si falta la clave ⇒ error explícito, nunca una llamada silenciosa.

**Consecuencia para el paquete de réplica:** un tercero clona el repositorio, ejecuta
`docker compose up` y `unihelp-eval run --llm-mode replay`, y obtiene **exactamente** las
mismas 800 trazas sin claves de API ni costo. Eso convierte la puerta de calidad de la semana 9
en algo verificable en vez de aspiracional.

Tamaño estimado de los casetes: ~800 × 40 KB ≈ 32 MB. Se versiona con Git LFS y se publica en
Zenodo junto con el dataset.

## 5. Microbenchmark de transporte

`unihelp-eval bench-transport` mide, **sin ningún LLM**, la latencia de:

| Transporte | Operación |
|---|---|
| Adaptador local (B0) | Llamada HTTP directa a la API |
| MCP Streamable HTTP (B1) | `tools/call` de una herramienta `noop` |
| Salto A2A (B3) | `message/send` con respuesta inmediata |
| A2A + MCP (B3 completo) | Orquestador → especialista → MCP → API |

1000 iteraciones, 100 de calentamiento, reportando p50/p95/p99 y desviación. Produce la
**Tabla 1** del artículo: el costo estructural de cada protocolo, independiente del modelo.
Es la tabla que hace que la afirmación "A2A cuesta X ms por salto" sea defendible.

## 6. Plan de análisis estadístico (pre-registrado, semana 2)

### 6.1 Hipótesis primarias

| H | Prueba | Criterio de decisión |
|---|---|---|
| **H1** (no-inferioridad B1 vs B0) | IC 95 % unilateral por bootstrap de conglomerados (10 000 remuestreos, tarea como conglomerado) sobre la diferencia de tasas de éxito | No-inferior si límite inferior > −0,07 |
| **H2** (B3 mejora compuestas) | Modelo logístico de efectos mixtos: `exito ~ condicion + (1|tarea)`, restringido a las 10 compuestas; contraste B3 vs B1 | *Odds ratio* con IC 95 %; además se reporta la penalización de latencia como razón de medianas |
| **H3** (confirmación) | Conteo exacto de escrituras no autorizadas + IC binomial de Clopper-Pearson (regla de tres si el conteo es 0) | Aprobada si escrituras no autorizadas = 0 **y** falso bloqueo ≤ 5 % |

### 6.2 Análisis de ablación (derivado de B-2)

| Contraste | Interpretación |
|---|---|
| B2 − B1 | Ganancia atribuible a la descomposición multiagente |
| B3 − B2 | Costo neto del transporte A2A (latencia, mensajes, tokens) |
| (B3 − B1) − (B2 − B1) | Verificación de consistencia: debe aproximarse a B3 − B2 |

### 6.3 Exploratorio (rotulado como tal)

Fidelidad de citación, éxito consistente, comportamiento por categoría, uso de recursos vs.
herramientas, tokens por condición. Corrección de comparaciones múltiples con
**Benjamini–Hochberg (FDR = 0,05)**. Se declara explícitamente en el artículo que estos
resultados son generadores de hipótesis, no confirmatorios.

### 6.4 Reporte obligatorio

Aunque los resultados sean desfavorables:

- Tabla completa 4 condiciones × 4 categorías con IC.
- Diagramas de caja de latencia por condición, con la descomposición apilada.
- Matriz de confusión de clasificación (B2/B3).
- Conteo de fallos por tipo (`status`) por condición.
- κ inter-revisor y acuerdo juez–humano.
- Bitácora de desviaciones y reejecuciones.

## 7. Presupuesto y control de costo

| Concepto | Estimación |
|---|---|
| Corrida oficial: 800 ejecuciones × ~10 300 tokens | ~8,2 M tokens |
| Pilotos A y B | ~1,5 M tokens |
| Juez LLM: 800 × ~2 500 tokens | ~2,0 M tokens |
| Robustez con modelo abierto | Local, sin costo de API |
| Reejecuciones y depuración (margen 30 %) | ~3,5 M tokens |
| **Total** | **~15 M tokens** |

Con precios típicos de un modelo de gama media, el rango razonable es **USD 40–150**. Debe
solicitarse el presupuesto en la semana 1 y configurarse una alerta de gasto. La depuración se
hace en modo `replay`, que es gratuito: esa es la principal palanca de control de costo.

## 8. Estructura de salida de una corrida

```
runs/2026-10-14-oficial/
├── manifest.json          # config, semilla, git_sha, imágenes, inicio/fin, operador
├── traces.jsonl           # 800 líneas validadas
├── invalid/               # trazas rechazadas por el validador (debe quedar vacío)
├── cassettes/             # casetes por ejecución
├── scores.parquet         # salida de `score`
├── judge/                 # entradas y salidas del juez, versión del prompt
├── reruns.md              # reejecuciones por infraestructura, con motivo
├── bench-transport.json   # microbenchmark de esa sesión
└── report/                # tablas y figuras generadas
```

`manifest.json` es el objeto que se cita en el artículo. Si no está completo, la corrida no existe.

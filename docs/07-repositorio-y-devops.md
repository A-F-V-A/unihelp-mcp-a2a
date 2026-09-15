# Repositorio, entorno y prácticas de ingeniería

## 1. Estructura

```
unihelp-interoperability-study/
├── README.md                       # qué es, cómo se replica en 5 comandos
├── CITATION.cff · LICENSE (MIT) · CONTRIBUTING.md
├── docker-compose.yml              # perfiles: base, b1, b2, full
├── .env.example                    # nunca .env
├── experiment.config.yaml          # ← EL archivo congelado en S6
│
├── apps/
│   ├── unihelp-api/                # Java 21 · Spring Boot 3.3 · Flyway · PostgreSQL 16
│   │   ├── src/main/resources/seed/
│   │   └── openapi.yaml
│   ├── mcp-server/                 # servidor MCP (5 herramientas, recursos, prompts)
│   ├── baseline-direct/            # B0
│   ├── agent-mcp/                  # B1
│   ├── multiagent-a2a/             # B3  (orchestrator/ knowledge/ diagnosis/)
│   ├── multiagent-local/           # B2 (ablación)
│   └── shared/                     # prompts, esquema del JSON final, cliente del modelo
│
├── prompts/
│   ├── base-v1.0.md                # prompt común a las 4 condiciones
│   └── diffs/                      # el delta exacto de cada condición
│
├── evaluation/
│   ├── tasks/                      # 40 YAML
│   ├── schemas/                    # task.schema.json · trace.schema.json · artifact schemas
│   ├── runner/                     # CLI, casetes, puntuador, benchmark
│   ├── judge/                      # prompt versionado + resultados
│   ├── sealed/tool5.spec.enc       # sobre sellado (S2 → S8)
│   ├── analysis/                   # notebooks
│   └── adjudications.md
│
├── runs/                           # salidas (Git LFS)
├── docs/
│   ├── 00…07 (estos documentos)
│   ├── adr/                        # ADR-001, ADR-002…
│   ├── reading-notes/              # fichas + referencias.md
│   ├── handover/                   # e1.md, e2.md, e3.md
│   ├── deviations.md
│   ├── prompt-diffs.md
│   └── paper/
└── .github/workflows/ci.yml
```

## 2. `experiment.config.yaml`

Un solo archivo determina todo lo que hay que citar en el artículo. Su hash entra en cada traza.

```yaml
version: "1.0"
congelado_en: "2026-10-16"

modelo_principal:
  proveedor: anthropic
  id: "<modelo>"
  snapshot: "<identificador exacto con fecha>"
  temperature: 0.2
  top_p: 1.0
  max_tokens: 2048

modelo_juez:
  proveedor: "<distinto al principal>"
  snapshot: "<...>"
  temperature: 0.0

modelo_robustez:
  proveedor: ollama
  id: "<modelo abierto>"
  quantizacion: "<...>"

experimento:
  condiciones: [B0, B1, B2, B3]
  repeticiones: 5
  semilla: 20261014
  timeout_por_ejecucion_s: 120
  max_turnos_agente: 8
  max_llamadas_herramienta: 20
  concurrencia: 4

protocolos:
  mcp:  { spec: "2025-11-25", sdk: "<paquete>@<versión>", transporte: "streamable-http" }
  a2a:  { spec: "1.0",        sdk: "<paquete>@<versión>", transporte: "jsonrpc" }

dataset:  { version: "1.0", tareas: 40 }
analisis: { margen_no_inferioridad: 0.07, bootstrap_iteraciones: 10000, fdr: 0.05 }
```

**Por qué `temperature: 0.2` y no 0:** con 0 las cinco repeticiones aportan casi nada y el
estudio no puede hablar de estabilidad. Con 0,2 se captura variabilidad realista sin volver el
sistema caótico. La decisión debe justificarse por escrito en un ADR, porque un revisor
preguntará por ella.

## 3. `docker compose` por perfiles

| Perfil | Servicios | Uso |
|---|---|---|
| `base` | postgres, unihelp-api | Desarrollo de la API, B0 |
| `b1` | base + mcp-server | B1 |
| `b2` | b1 + knowledge-agent, diagnosis-agent, orchestrator | B3 |
| `full` | todo + ollama | Robustez de S8 |

Requisitos: `healthcheck` en los seis servicios; `docker compose --profile full up` sano en
menos de 90 s; volúmenes efímeros para que un reinicio sea equivalente a un reset.

## 4. CI (`.github/workflows/ci.yml`)

| Trabajo | Qué corre | Bloquea el merge |
|---|---|---|
| `lint` | Formato Java y Python, `ruff`, `spotless` | Sí |
| `test-api` | Pruebas unitarias + integración con Testcontainers | Sí |
| `test-mcp` | Pruebas de herramienta, validación y golden file de `tools/list` | Sí |
| `test-a2a` | Ciclo de vida, aislamiento, privilegio, degradación | Sí |
| `validate-dataset` | Los 40 YAML contra `task.schema.json` | Sí |
| `validate-traces` | Trazas de ejemplo contra `trace.schema.json` | Sí |
| `arch-test` | El orquestador no importa a los especialistas | Sí |
| `compose-smoke` | `--profile b2 up` + una tarea en modo `replay` de punta a punta | Sí |
| `coverage` | ≥ 70 % en API y servidor MCP | Sí desde S6 |
| `secrets-scan` | `gitleaks` | Sí |

El trabajo `compose-smoke` es el que evita el escenario clásico: todo verde en CI y nada
funciona junto.

## 5. Flujo de trabajo

- Ramas: `main` protegida; `feat/…`, `fix/…`, `exp/…`, `docs/…`.
- Todo cambio entra por PR con **una** revisión de un compañero. Un PR sin revisión no mergea,
  ni siquiera en la semana 7.
- Plantilla de PR: qué cambia, qué prueba lo cubre, si toca el experimento congelado, y en ese
  caso el enlace a la entrada en `deviations.md`.
- Commits convencionales (`feat:`, `fix:`, `exp:`, `docs:`), en español.
- Un ADR por decisión relevante: contexto, decisión, alternativas, consecuencias, responsable, fecha.

### ADR mínimos esperados

| # | Decisión |
|---|---|
| 001 | Stack por componente (Java para la API, Python para agentes y MCP) |
| 002 | Recuperación léxica determinista en vez de embeddings |
| 003 | Confirmación en dos fases con token del servidor |
| 004 | Los prompts MCP quedan fuera de la corrida oficial |
| 005 | `temperature: 0.2` y cinco repeticiones |
| 006 | Margen de no-inferioridad δ = 0,07 |
| 007 | Inclusión de la condición de ablación B2 |
| 008 | Casetes record/replay para reproducibilidad sin claves |
| 009 | Modelo abierto local como chequeo de robustez acotado |
| 010 | Selección del venue y su impacto en el calendario |

## 6. Seguridad y manejo de datos

- **Cero secretos versionados.** `.env.example` documenta las variables; `gitleaks` en CI.
- **Datos exclusivamente sintéticos.** Ningún nombre, correo o identificación real. Los
  solicitantes son `EST-0001`… y los correos usan `@ejemplo.invalid`.
- **Sin sistemas institucionales.** La API es un simulador; ninguna acción sale del entorno.
- **Registro sin contenido sensible:** `audit_event` guarda hash del cuerpo, no el cuerpo.
- Declaración en el artículo: al usar solo datos sintéticos y no involucrar participantes
  humanos como sujetos de estudio, no se requiere aval de comité de ética; la calificación
  humana de la rúbrica la realizan los propios autores.

## 7. Definition of Done (aplica a toda tarea del backlog)

Una tarea está terminada solo si cumple **las seis**:

1. Código en `main` vía PR revisado y aprobado.
2. Prueba automatizada que cubre el comportamiento nuevo (no solo que compila).
3. Documentación mínima actualizada: el documento de `docs/` que corresponda.
4. Si toca contratos (API, MCP, A2A): esquema y golden file actualizados en el mismo PR.
5. Si toca el experimento congelado: entrada en `deviations.md`.
6. Demostrada en la demo del viernes, ejecutándose.

## 8. Handover y factor bus

`docs/handover/<rol>.md`, actualizado **cada viernes**, con:

- Qué componentes posee el rol y dónde vive cada uno.
- Cómo se levanta y se depura localmente, con comandos exactos.
- Decisiones tomadas y por qué (enlaces a ADR).
- Qué está a medias y cuál es el siguiente paso concreto.
- Suplente designado.

Programación en pareja obligatoria en: servidor MCP (S4), orquestador A2A (S5) y runner (S2–S3).
Son los tres componentes cuya pérdida hundiría el semestre.

## 9. Los cinco comandos de la réplica

El `README` debe reducirse a esto, y la prueba de la semana 9 consiste en que un tercero los ejecute:

```bash
git clone <repo> && cd unihelp-interoperability-study
cp .env.example .env
docker compose --profile b2 up -d --wait
uv run unihelp-eval run --config experiment.config.yaml --llm-mode replay --out runs/replica
uv run unihelp-eval report runs/replica
```

Si hace falta un sexto comando o una explicación adicional, el paquete de réplica no está listo.

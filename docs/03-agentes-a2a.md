# Agentes A2A — Agent Cards, ciclo de vida y contratos

Especificación **A2A v1.0**. Transporte JSON-RPC 2.0 sobre HTTP(S), con SSE para *streaming*.
Descubrimiento por `GET /.well-known/agent-card.json`.

## 1. Topología

```
   usuario / runner
         │  (mensaje inicial)
         ▼
  ┌──────────────────┐   A2A message/send   ┌────────────────────┐
  │  orchestrator    │ ───────────────────► │ knowledge-agent    │──MCP──┐
  │  :8084           │ ◄─────────────────── │ :8082              │       │
  │                  │      Artifact        └────────────────────┘       ▼
  │  clasifica       │                                              ┌─────────┐
  │  delega          │   A2A message/send   ┌────────────────────┐  │ MCP     │
  │  confirma        │ ───────────────────► │ diagnosis-agent    │──│ server  │
  │  crea ticket     │ ◄─────────────────── │ :8083              │  └─────────┘
  └──────────────────┘      Artifact        └────────────────────┘
```

**Restricción no negociable (riesgo del plan original):** los especialistas se ejecutan como
procesos y contenedores separados y solo se alcanzan por HTTP. En el `docker-compose.yml` del
perfil `b2` cada agente tiene su propio servicio. Una prueba de arquitectura verifica que el
paquete del orquestador **no importe** los módulos de los especialistas:

```python
# tests/test_arquitectura.py
def test_orquestador_no_importa_especialistas():
    src = Path("apps/multiagent-a2a/orchestrator").rglob("*.py")
    prohibido = ("knowledge_agent", "diagnosis_agent")
    for f in src:
        assert not any(p in f.read_text() for p in prohibido), f
```

La condición **B2** vive en un paquete distinto (`apps/multiagent-local`) que sí
importa los especialistas, y esa es precisamente su razón de existir.

## 2. Agent Cards

### 2.1 `knowledge-agent`

```json
{
  "protocolVersion": "1.0",
  "name": "UniHelp Knowledge Agent",
  "description": "Recupera y resume la política, procedimiento o guía institucional aplicable a una solicitud sobre servicios digitales universitarios. No ejecuta acciones de escritura.",
  "url": "http://knowledge-agent:8082/a2a",
  "preferredTransport": "JSONRPC",
  "version": "1.0.0",
  "provider": {
    "organization": "Universidad del Quindío — Programa de Ingeniería de Sistemas y Computación",
    "url": "https://github.com/<org>/unihelp-interoperability-study"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "stateTransitionHistory": true
  },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain", "application/json"],
  "skills": [
    {
      "id": "knowledge_lookup",
      "name": "Consulta de política institucional",
      "description": "Dada una solicitud en lenguaje natural, identifica la política aplicable y devuelve un resumen con las fuentes citadas (código y versión).",
      "tags": ["politicas", "procedimientos", "conocimiento"],
      "examples": [
        "¿Cuál es el plazo para solicitar la reactivación del correo institucional?",
        "¿Qué requisitos hay para cancelar una asignatura fuera de fecha?"
      ],
      "inputModes": ["text/plain"],
      "outputModes": ["application/json"]
    }
  ]
}
```

### 2.2 `diagnosis-agent`

```json
{
  "protocolVersion": "1.0",
  "name": "UniHelp Diagnosis Agent",
  "description": "Interpreta síntomas reportados sobre servicios digitales, consulta su estado operativo y determina impacto, alcance y prioridad sugerida. No crea tickets.",
  "url": "http://diagnosis-agent:8083/a2a",
  "preferredTransport": "JSONRPC",
  "version": "1.0.0",
  "capabilities": { "streaming": true, "pushNotifications": false, "stateTransitionHistory": true },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["application/json"],
  "skills": [
    {
      "id": "incident_diagnosis",
      "name": "Diagnóstico de incidente",
      "description": "Relaciona los síntomas descritos con el estado y los componentes afectados del servicio, y devuelve un diagnóstico estructurado con prioridad calculada según la tabla institucional.",
      "tags": ["diagnostico", "incidentes", "estado"],
      "examples": [
        "No puedo subir archivos al aula virtual desde ayer",
        "El correo institucional rebota todos los mensajes externos"
      ],
      "outputModes": ["application/json"]
    }
  ]
}
```

### 2.3 `orchestrator`

```json
{
  "protocolVersion": "1.0",
  "name": "UniHelp Triage Orchestrator",
  "description": "Punto de entrada del triaje. Clasifica la solicitud, delega en los agentes especialistas mediante A2A, solicita confirmación explícita al usuario y crea el ticket simulado únicamente tras esa confirmación.",
  "url": "http://orchestrator:8084/a2a",
  "preferredTransport": "JSONRPC",
  "version": "1.0.0",
  "capabilities": { "streaming": true, "pushNotifications": false, "stateTransitionHistory": true },
  "skills": [
    {
      "id": "incident_triage",
      "name": "Triaje de incidentes de servicios digitales",
      "description": "Resuelve solicitudes informativas, de diagnóstico o compuestas sobre aula virtual, correo institucional, autenticación y matrícula.",
      "tags": ["triaje", "soporte", "universidad"],
      "examples": [
        "El aula virtual va lentísima y necesito saber si puedo pedir prórroga para la entrega",
        "¿Cómo recupero mi contraseña institucional?"
      ]
    }
  ]
}
```

**Registro de descubrimiento:** el orquestador **no** lleva las URL de los especialistas
codificadas en el prompt. Lee `config/a2a-registry.yaml` con las URL base, hace `GET` de cada
Agent Card al arrancar y selecciona el agente por `skills[].id`. Así, agregar un tercer
especialista es un cambio de configuración —lo cual es material directo para la métrica de
modularidad en la dimensión A2A, complementando la de MCP.

## 3. Ciclo de vida de la tarea A2A

Estados usados y su significado en UniHelp:

| Estado | Cuándo |
|---|---|
| `submitted` | El orquestador recibió el mensaje del usuario |
| `working` | Clasificando o esperando respuesta de un especialista |
| `input-required` | **Se propuso un ticket y se espera la confirmación del usuario** |
| `completed` | Respuesta final entregada (con o sin ticket) |
| `failed` | Error irrecuperable |
| `rejected` | Solicitud fuera de alcance o intento inseguro |

El uso de `input-required` para la confirmación humana es intencional: es el mecanismo nativo
de A2A para *human-in-the-loop* y produce la figura más informativa del artículo (el mismo
requisito de seguridad expresado como turno conversacional en B0/B1 y como transición de
estado del protocolo en B3).

### 3.1 Secuencia de una tarea compuesta en B3

```
runner        orchestrator      knowledge-agent    diagnosis-agent    mcp-server    api
  │  msg/send      │                   │                  │              │          │
  ├───────────────►│ submitted         │                  │              │          │
  │                │ working                              │              │          │
  │                │ ──── msg/send (knowledge_lookup) ───►│              │          │
  │                │                   │ tools/call buscar_politica ────►│─────────►│
  │                │◄──── Artifact: politica_aplicable ───┤              │          │
  │                │ ──── msg/send (incident_diagnosis) ─────────────────►│         │
  │                │                   │                  │ consultar_estado ──────►│
  │                │◄──── Artifact: diagnostico ──────────────────────────┤         │
  │                │ tools/call proponer_ticket ───────────────────────►│──────────►│
  │                │ input-required (resumen_legible)     │              │          │
  │◄───────────────┤                   │                  │              │          │
  │  msg/send "sí, créalo"             │                  │              │          │
  ├───────────────►│ working           │                  │              │          │
  │                │ tools/call confirmar_propuesta ───────────────────►│──────────►│
  │                │ tools/call crear_ticket_simulado ────────────────►│───────────►│
  │                │ completed + Artifact: resultado_triaje             │           │
  │◄───────────────┤                   │                  │             │           │
```

## 4. Artefactos A2A

Los especialistas devuelven `DataPart` con JSON validado, no prosa. La prosa la compone el
orquestador. Esto hace que los artefactos sean evaluables automáticamente.

### 4.1 `politica_aplicable`
```json
{
  "artifactId": "politica_aplicable",
  "name": "Política aplicable",
  "parts": [{
    "kind": "data",
    "data": {
      "politicas": [
        { "codigo": "POL-AV-003", "titulo": "...", "version": "1.1",
          "extracto": "...", "relevancia": 0.87 }
      ],
      "resumen": "Texto de 2 a 4 frases, sin cifras que no estén en los extractos.",
      "confianza": "alta",
      "sin_resultados": false
    }
  }]
}
```

### 4.2 `diagnostico`
```json
{
  "artifactId": "diagnostico",
  "name": "Diagnóstico del incidente",
  "parts": [{
    "kind": "data",
    "data": {
      "servicio": "aula_virtual",
      "estado": "DEGRADADO",
      "alcance": "parcial",
      "componentes_afectados": ["carga_de_archivos"],
      "sintomas_correlacionados": ["lentitud al subir archivos"],
      "prioridad_sugerida": "P3",
      "justificacion_prioridad": "DEGRADADO + alcance parcial ⇒ P3 según tabla institucional",
      "accion_recomendada": "crear_ticket",
      "incidente_ref": "INC-2026-0042"
    }
  }]
}
```

`accion_recomendada` ∈ `{crear_ticket, informar_y_esperar, escalar, sin_accion}`.
El valor `informar_y_esperar` es el que debe salir en los casos de `MANTENIMIENTO`.

### 4.3 `resultado_triaje` (del orquestador)
```json
{
  "artifactId": "resultado_triaje",
  "parts": [
    { "kind": "text", "text": "Respuesta final al usuario en español." },
    { "kind": "data", "data": {
        "clasificacion": "compuesta",
        "politicas_citadas": ["POL-AV-003"],
        "diagnostico": { "servicio": "aula_virtual", "prioridad": "P3" },
        "ticket": { "creado": true, "id": "UNI-2026-000124" },
        "confirmacion": { "solicitada": true, "otorgada": true },
        "agentes_consultados": ["knowledge_lookup", "incident_diagnosis"]
    }}
  ]
}
```

Este `DataPart` es lo que consume directamente el evaluador automático. En B0/B1 el agente
único debe emitir **el mismo objeto** como bloque JSON final, para que la evaluación sea
idéntica en las cuatro condiciones. Es un requisito de comparabilidad, no un capricho de formato.

## 5. Alcance de capacidades (seguridad entre agentes)

| Agente | Herramientas MCP permitidas |
|---|---|
| `knowledge-agent` | `buscar_politica` |
| `diagnosis-agent` | `consultar_estado_servicio` |
| `orchestrator` | `proponer_ticket`, `confirmar_propuesta`, `crear_ticket_simulado` |

La restricción se aplica en **dos lugares**: filtrando `tools/list` por agente en el cliente
MCP, y validando en el servidor mediante la cabecera `X-Agent-Id`. Una prueba adversarial
(categoría *diputado confundido*) verifica que el `knowledge-agent` recibe **403** al intentar
`crear_ticket_simulado`.

Esta separación es exactamente lo que el artículo puede reclamar como beneficio arquitectónico
de A2A + MCP: el privilegio se expresa en la topología, no en el prompt.

## 6. Observabilidad A2A

Cada mensaje A2A lleva:

```json
"metadata": {
  "traceId": "run-2026-10-14T03:11:02Z-T-COM-004-B3-r3",
  "hop": 2,
  "emisor": "orchestrator",
  "receptor": "diagnosis-agent",
  "t_emision": "2026-10-14T03:11:03.412Z"
}
```

El runner reconstruye el grafo de saltos y calcula `transport_ms` como
`t_recepcion − t_emision − tiempo_de_procesamiento_del_receptor`. El agente receptor reporta
su propio tiempo de procesamiento en el artefacto, de modo que la resta es exacta y no una
estimación.

## 7. Pruebas obligatorias de B3

| Grupo | Contenido |
|---|---|
| Descubrimiento | Las tres Agent Cards se sirven, validan contra el esquema A2A 1.0 y se resuelven por `skills[].id` |
| Ciclo de vida | Recorrido completo `submitted → working → input-required → working → completed` |
| Confirmación | `input-required` no avanza sin turno del usuario; una negación produce `completed` sin ticket |
| Aislamiento | `test_orquestador_no_importa_especialistas` (sección 1) |
| Privilegio | El `knowledge-agent` recibe 403 en herramientas de escritura |
| Degradación | Con `diagnosis-agent` caído, el orquestador responde `failed` con motivo, **sin inventar** un diagnóstico |
| Concurrencia | 10 tareas A2A simultáneas sin mezcla de `taskId` |
| Equivalencia B3/B2 | Con la misma entrada y casete, B3 y B2 producen el mismo `resultado_triaje` salvo campos de temporización |

La última prueba es la que hace creíble la ablación: si B2 y B3 difieren en algo más que la
latencia, la comparación B3−B2 deja de medir el costo del transporte.


---

## 4. Cómo funciona por dentro

### 4.1 El ciclo de un turno

Un turno empieza cuando la persona (o el ejecutor del experimento) envía un
mensaje. `AtenderTurnoUseCase` valida el texto (10 a 2 000 caracteres), aplica el
límite de 8 turnos, guarda el turno literal en PostgreSQL **antes** de que el
modelo lo vea y entrega el historial al bucle del agente
(`libs/agente-nucleo/src/lib/conversacion/atender-turno.use-case.ts:72-92`).

<!-- diagrama: diag-02-turno -->
```mermaid
{{mermaid:02-turno}}
```

*Figura 2. Un turno de chat de punta a punta. Fuente:
[`diagramas/02-turno.mmd`](diagramas/02-turno.mmd).*

### 4.2 El bucle del agente

`BucleAgente` (`libs/agente-nucleo/src/lib/agente/bucle-agente.ts`) es un bucle
de *function calling* que corre igual en las cuatro arquitecturas y en los
especialistas de B2 y B3:

1. Calcula el presupuesto restante; si se agotó, termina con `timeout` (:84-87).
2. Pide la lista de herramientas al puerto **antes de cada llamada al modelo**, lo
   que permite agregar herramientas en caliente (HU-27) (:88).
3. Llama al modelo con `parallel_tool_calls: false` y `tool_choice: 'auto'`
   (`libs/agente-nucleo/src/lib/modelo/cliente-modelo.ts:128-129`): nunca hay paralelismo dentro de una ejecución
   (RM-04, D1).
4. Si el modelo no pide herramientas, termina con `respuesta` (:112-119).
5. Si pide herramientas, las ejecuta de a una y en orden; cada resultado vuelve
   como mensaje con rol de herramienta, nunca pegado al texto de la persona
   (:122-175).

El bucle termina de tres maneras: respuesta, `timeout` (120 000 ms de
procesamiento por conversación) o `limite_herramientas` (20 llamadas por
conversación, que cuenta el receptor, no el bucle; `libs/herramientas/src/lib/ejecutor-capacidad.ts:81-90`).
Los parámetros del modelo son fijos: temperatura 0,2, `top_p` 1 y 2 048 tokens de
salida (`libs/agente-nucleo/src/lib/configuracion/configuracion-agente.ts:191-203`).

Al final, el modelo escribe un **objeto final JSON** con la clasificación, la
confianza, las políticas citadas, el diagnóstico, el ticket y la confirmación
(`libs/herramientas/src/lib/objeto-final.ts:32-69`). `ExtractorObjetoFinal` lo
separa del texto y lo valida con AJV; un objeto inválido se retira del texto pero
no cuenta como objeto final (`libs/agente-nucleo/src/lib/agente/extractor-objeto-final.ts:109-129`).

### 4.3 El prompt base

El prompt de sistema vive en `libs/herramientas/src/lib/prompt-base.ts:95-175`,
en la versión **1.4.0** (:48), y tiene nueve secciones: alcance, qué fuentes
consultar, cómo buscar una política, cómo responder, tabla institucional de
prioridad, registro de tickets, seguridad, formato de la respuesta final y una
lista de comprobación final (:56-66). B0 y B1 usan el mismo prompt, byte por
byte. El orquestador de B2 y B3 usa un prompt derivado del base por inserción y
sustitución mecánica, y los especialistas usan secciones enteras del base, sin
copiar texto (`libs/multiagente-nucleo/src/lib/prompts/`, `docs/prompt-diffs.md`).

Las versiones 1.2.0 a 1.4.0 del prompt se decidieron después de ver fallos en
corridas de B0 (decisiones 34 a 36).

### 4.4 Las cinco herramientas

Definidas en `libs/herramientas/src/lib/definiciones-herramientas.ts:67-287`:

| Herramienta | Qué hace | Entrada | Salida |
| --- | --- | --- | --- |
| `buscar_politica` | Búsqueda léxica de hasta 3 políticas, un extracto por cada una | `consulta` (3–300 caracteres), `servicio` y `categoria` opcionales, `max_resultados` 1–3 | `resultados[{codigo, titulo, version, extracto, relevancia, …}]`, `motivo_sin_resultados` |
| `consultar_estado_servicio` | Estado operativo de un servicio | `servicio` (4 valores) | `estado`, `componentes_afectados`, `alcance`, `nivel_sla`, `mensaje`, `ventana_estimada` |
| `proponer_ticket` | Prepara la propuesta; **no crea el ticket** | `servicio`, `categoria`, `prioridad` P1–P4, `resumen`, `descripcion` | `proposal_id`, `resumen_legible`, `listo_para_confirmar` |
| `confirmar_propuesta` | Registra la confirmación de la persona y emite un token | `proposal_id`, `texto_confirmacion`, `actor = usuario` | `confirmacion_token`, `aceptada`, `motivo_rechazo` |
| `crear_ticket_simulado` | Crea el ticket si el token es válido | `proposal_id`, `confirmacion_token` | `ticket_id`, `estado`, `creado` |

Los errores tienen ocho códigos tipados, en español: `VALIDACION_ENTRADA`,
`RECURSO_NO_ENCONTRADO`, `CONFIRMACION_REQUERIDA`, `PROPUESTA_EXPIRADA`,
`PROPUESTA_INCOMPLETA`, `PROPUESTA_RESUELTA`, `SERVICIO_NO_DISPONIBLE` y
`LIMITE_EXCEDIDO` (`libs/herramientas/src/lib/errores-herramienta.ts:6-15`). Un error de negocio vuelve al
modelo, que puede corregirse; un fallo de infraestructura es distinto y hace que
la ejecución se excluya (RM-15).

El contrato se aparta de `docs/02` en tres puntos deliberados: hasta 3 resultados
en lugar de 5, sin `incluir_historial` y sin `solicitante` (decisión 24).

Cada invocación pasa por `EjecutorCapacidad`, el **mismo código** en B0 y en
`mcp-server` (`libs/herramientas/src/lib/ejecutor-capacidad.ts:72-109`): cuenta la llamada contra el
límite, valida los argumentos con AJV (mensajes en español), ejecuta, mide la
duración con reloj monótono y audita siempre.

**Defensa ante inyección.** Todo contenido recuperado (extractos, comunicados)
se envuelve en un bloque delimitado con un marcador derivado del `traceId`, y un
detector determinista de 9 patrones agrega una advertencia si ve instrucciones
dentro del contenido, sin borrarlo (`libs/herramientas/src/lib/saneador-contenido.ts:32-53`,
`libs/herramientas/src/lib/detector-instrucciones.ts:9-21`).

### 4.5 La base de conocimiento: búsqueda léxica determinista

La base vive en PostgreSQL, en un esquema `conocimiento` con un grafo de
servicios, componentes, estados, categorías, políticas, versiones y extractos
(`libs/conocimiento/src/infraestructura/migraciones/1789344000000-crear-grafo-conocimiento.ts`).

| Elemento de la semilla `2026.09.14-2` | Cantidad |
| --- | --- |
| Servicios / componentes | 4 / 13 |
| Estados iniciales | 10 |
| Políticas | 39 (36 en el corpus estándar, 3 adversariales) |
| Versiones de política | 55 |
| Extractos | 162 |

El anexo preveía 24 políticas; el repositorio tiene 39, con 15 distractoras y 3
adversariales redactadas (decisión 18).

**La búsqueda** (`libs/conocimiento/src/infraestructura/typeorm-conocimiento.repository.ts:53-113`):

1. Normaliza la consulta y extrae sus lexemas con la configuración `español +
   unaccent`.
2. Busca las versiones vigentes que contienen alguno de los lexemas.
3. Calcula la relevancia como `ts_rank × (lexemas presentes / lexemas de la
   consulta)`, redondeada a 6 decimales para que los empates sean exactos.
4. Elige **un solo extracto por política**: el de mayor `ts_rank`.
5. Descarta lo que queda bajo el umbral 0,05, ordena por relevancia y desempata
   por código en orden binario (RM-10), y devuelve como mucho 3 políticas.

**Por qué no hay embeddings (RM-01).** Una recuperación estocástica haría
imposible saber si un fallo vino del protocolo o del recuperador (decisión 17;
`docs/00-revision-critica.md:282`). La búsqueda es léxica, determinista y
calibrada con 16 consultas objetivo y 6 sin respuesta.

**Huella de estado.** Antes de cada ejecución, el ejecutor restablece la base a
uno de 20 estados posibles (10 estados × 2 corpus) y compara su huella SHA-256
canónica con la esperada; si no coincide, aborta la ejecución antes de gastar
tokens (`libs/conocimiento/src/aplicacion/huella.ts:10-13`, `libs/conocimiento/src/aplicacion/huellas-esperadas.ts:14-31`).

### 4.6 El flujo de tickets

<!-- diagrama: diag-08-ticket -->
```mermaid
{{mermaid:08-ticket}}
```

*Figura 3. Ciclo de propuesta, confirmación y creación del ticket. Fuente:
[`diagramas/08-ticket.mmd`](diagramas/08-ticket.mmd).*

- **Propuesta.** `proponer_ticket` verifica la prioridad contra la tabla
  institucional (P1 a P4 según estado, alcance y nivel del servicio; en
  mantenimiento no se propone ticket) y guarda una propuesta que vence en 15
  minutos (`libs/tickets/src/aplicacion/proponer-ticket.use-case.ts:49-128`).
- **Confirmación.** Por texto, solo si el texto coincide con un turno real de la
  persona escrito después de la propuesta y un clasificador determinista lo lee
  como afirmación (la negación gana, luego la ambigüedad); por botón, con
  `confirmacionExplicita: true`. El token son 24 bytes aleatorios y la base
  guarda solo su SHA-256 (`libs/tickets/src/aplicacion/confirmar-propuesta.use-case.ts:48-190`).
- **Creación.** En una transacción con bloqueo de fila, exige el token válido y no
  vencido; es idempotente (`libs/tickets/src/aplicacion/crear-ticket.use-case.ts:41-121`).
- **Auditoría de solo agregar (RM-09).** Cada operación deja un evento con la
  huella SHA-256 del cuerpo, nunca el cuerpo; triggers bloquean `UPDATE`,
  `DELETE` y `TRUNCATE`, y el restablecimiento del experimento vacía los tickets
  pero nunca la auditoría (decisión 31). Esa auditoría es la fuente independiente
  de las métricas de seguridad M5.

### 4.7 La instrumentación

La medición está pensada para que las restas entre arquitecturas sean limpias:

- **Reloj monótono siempre** (RM-06): `performance.now()`
  (`libs/herramientas/src/lib/reloj-monotono.ts:7-9`).
- **Descomposición de la latencia**: `llm_ms` (ida y vuelta al modelo),
  `tool_exec_ms` (duración que reporta el receptor), `transport_ms` y un residuo
  de orquestación = total − modelo − herramientas − transporte
  (`libs/agente-nucleo/src/lib/agente/instrumentador-trazas.ts:110-219`).
- **Transporte sin restar relojes de procesos distintos** (RM-05, D5): el emisor
  mide la ida y vuelta con su reloj y le resta la duración que el receptor midió
  con el suyo y le devolvió (en MCP, en `_meta['unihelp/duracion_ms']`). En B0 la
  ida y vuelta también se mide, así que el transporte nunca vale cero por
  construcción.
- **Trazas.** El backend expone lo que midió en `GET /experimento/trazas/:traceId`;
  el ejecutor arma la traza completa y la valida contra
  `experiment/schemas/traza.schema.json` antes de guardarla (decisión 32). Una
  traza inválida va a cuarentena.

### 4.8 Casetes y proveedores de modelo

- **Casetes.** Con `UNIHELP_MODO_LLM=record` cada llamada al modelo se guarda en un
  archivo cuya clave es el SHA-256 de modelo, mensajes, herramientas y parámetros;
  con `replay` se reproduce sin llamar al proveedor (`libs/agente-nucleo/src/lib/modelo/casete-modelo.ts:23-72`).
  Todas las campañas se corrieron en `record`. Los casetes no se versionan
  (AGENTS.md regla 9), así que la reproducción desde casetes (M7.6) quedó sin
  datos.
- **Proveedores.** OpenAI, Ollama (local) y Gemini se usan con el mismo SDK de
  OpenAI y la misma API de Chat Completions; solo cambia la URL base
  (`libs/agente-nucleo/src/lib/configuracion/configuracion-agente.ts:31-45`; decisiones 46 y 48).

---

## 5. Las cuatro arquitecturas

Cada arquitectura aporta una sola pieza propia: la implementación de un puerto.
Todo lo demás es el mismo código (`docs/arquitecturas.md:12-17`).

| | B0 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- |
| Apps | `b0-directo` :3000 | `b1-mcp-agente` :3001 + `mcp-server` :3010 | `b2-multiagente-local` :3002 + `mcp-server` | `b3-a2a-orquestador` :3003, `-conocimiento` :3004, `-diagnostico` :3005 + `mcp-server` |
| Puerto propio | `CapacidadesLocales` | `CapacidadesMcp` sin rol | `EspecialistasEnProceso` | `EspecialistasA2a` |
| Agentes con modelo | 1 | 1 | 3 en un proceso | 3 en tres procesos |
| Herramientas del agente | llamada a método | MCP | MCP con `X-Agent-Id` por rol | MCP con `X-Agent-Id` por rol |
| Entre agentes | — | — | llamada en proceso | A2A (JSON-RPC sobre HTTP) |

### 5.1 B0 · Directo

<!-- diagrama: diag-03-b0 -->
```mermaid
{{mermaid:03-b0}}
```

*Figura 4. B0. Fuente: [`diagramas/03-b0.mmd`](diagramas/03-b0.mmd).*

Un solo agente con las cinco herramientas en el mismo proceso. `CapacidadesLocales`
llama al invocador y normaliza el resultado con una serialización JSON de ida y
vuelta, para que su forma sea idéntica a la que llega por MCP
(`libs/capacidades/src/lib/capacidades-locales.ts:18-62`). Es la línea base.

### 5.2 B1 · MCP

<!-- diagrama: diag-04-b1 -->
```mermaid
{{mermaid:04-b1}}
```

*Figura 5. B1. Fuente: [`diagramas/04-b1.mmd`](diagramas/04-b1.mmd).*

El mismo agente que B0, con el mismo prompt, pero las herramientas viven en
`mcp-server` y se descubren con `tools/list`. B1 conserva acceso directo a la
base solo para lo que no son capacidades del agente: el turno literal, los
botones de la interfaz y las rutas del ejecutor (DP-B1-01,
`apps/b1-mcp-agente/docs/ARQUITECTURA.md:370-384`). **Qué cambia respecto de
B0**: solo el transporte de las herramientas.

### 5.3 B2 · Multiagente en proceso

<!-- diagrama: diag-05-b2 -->
```mermaid
{{mermaid:05-b2}}
```

*Figura 6. B2. Fuente: [`diagramas/05-b2.mmd`](diagramas/05-b2.mmd).*

Tres agentes con modelo en el mismo proceso
(`libs/multiagente-nucleo`, `docs/prompt-diffs.md:56-79`):

- **Orquestador.** Ve dos habilidades de delegación (`knowledge_lookup`,
  `incident_diagnosis`) y las tres herramientas de tickets, que usa por MCP con
  `X-Agent-Id: orquestador`. Es quien habla con la persona y quien propone el
  ticket.
- **Especialista de conocimiento.** Solo usa `buscar_politica` y devuelve un
  artefacto `politica_aplicable` validado con AJV.
- **Especialista de diagnóstico.** Solo usa `consultar_estado_servicio` y
  devuelve un artefacto `diagnostico` con estado, prioridad sugerida y acción
  recomendada.

Cada especialista tiene su propio cliente del modelo, su propia sesión MCP y
atiende cada delegación como una conversación nueva
(`libs/multiagente-nucleo/src/lib/especialista/agente-especialista.ts:46-156`). `EspecialistasEnProceso` serializa la entrada y
la salida como si viajaran, para que la forma sea idéntica a B3
(`apps/b2-multiagente-local/src/app/especialistas-en-proceso/especialistas-en-proceso.ts:30-66`).
**Qué cambia respecto de B1**: la coordinación de tres modelos en lugar de uno.

### 5.4 B3 · A2A distribuido

<!-- diagrama: diag-06-b3 -->
```mermaid
{{mermaid:06-b3}}
```

*Figura 7. B3. Fuente: [`diagramas/06-b3.mmd`](diagramas/06-b3.mmd).*

Los mismos tres agentes que B2, cada uno en su proceso. El orquestador descubre a
los especialistas leyendo `apps/b3-a2a-orquestador/config/a2a-registry.yaml` y pidiendo sus Agent Cards;
les delega con `message/send` por JSON-RPC 2.0 sobre HTTP. **Qué cambia respecto
de B2**: solo el transporte entre agentes.

<!-- diagrama: diag-07-secuencia-b3 -->
```mermaid
{{mermaid:07-secuencia-b3}}
```

*Figura 8. Secuencia de una delegación en B3. Fuente:
[`diagramas/07-secuencia-b3.mmd`](diagramas/07-secuencia-b3.mmd).*

La primera versión de B3 era un clasificador por reglas sin modelo (decisión 43);
se reemplazó por el sistema con modelo de la decisión 44 para que B3 − B2 mida el
transporte y no una lógica distinta.

---

## 6. Los protocolos: MCP y A2A

### 6.1 MCP (Model Context Protocol)

**Qué resuelve.** Separa las herramientas del agente: un servidor las publica con
su esquema y cualquier cliente las descubre y las invoca.

**Cómo está implementado.**

- `@modelcontextprotocol/sdk` 1.30.1, especificación `2025-11-25` (decisión 42).
  Se usa el `Server` de bajo nivel para publicar los JSON Schema del contrato sin
  transformarlos (`apps/mcp-server/src/app/mcp/servidor-herramientas-mcp.ts:155-163`).
- **Streamable HTTP con sesiones**: `POST/GET/DELETE /mcp`, una sesión por
  cliente con identificador en la cabecera `mcp-session-id`; una sesión
  desconocida recibe error 404 / JSON-RPC −32000 (`apps/mcp-server/src/app/mcp/sesiones-mcp.ts:58-89`).
- **`tools/list`** publica nombre, título, descripción, esquemas de entrada y
  salida y anotaciones (`readOnlyHint`, `idempotentHint`, `destructiveHint`). La
  instantánea versionada `apps/mcp-server/contrato/tools-list.instantanea.json`
  y una prueba garantizan que lo que ve B1 es idéntico a lo que ve B0 (RM-12).
- **`tools/call`** invoca el mismo `InvocadorCapacidades` que B0 y devuelve el
  resultado con `_meta`: la duración medida en el servidor, el dato sin sanear
  para la traza y el error de negocio con `isError`
  (`apps/mcp-server/src/app/mcp/servidor-herramientas-mcp.ts:123-199`).
- **Filtro por rol**: con `X-Agent-Id`, el servidor rechaza cualquier herramienta
  fuera del mapa `PERMISOS_AGENTE` del rol (`libs/contratos/src/lib/mcp.contrato.ts:58-62`);
  el cliente además filtra la lista que ve su modelo. Sin cabecera (B1) no se
  restringe.
- **`tools/list_changed`**: el servidor la emite a las sesiones abiertas cuando se
  registra una herramienta en caliente (`apps/mcp-server/src/app/mcp/sesiones-mcp.ts:109-122`), y el cliente
  olvida su lista al recibirla (`libs/capacidades-mcp/src/lib/capacidades-mcp.ts:221-226`).

**Ventajas y desventajas, según lo medido.**

| A favor | En contra |
| --- | --- |
| No cambia tokens, latencia ni llamadas al modelo frente a B0 en ningún modelo (T5) | Cada salto cuesta 13,1 ms en p50 sin modelo, frente a 0,001 ms en proceso (T4); en las ejecuciones reales el transporte MCP suma de 3,7 a 12,0 ms por ejecución (T3) |
| Privilegios aplicados en el servidor, no solo en el prompt | Cambiar de proceso crea casos borde: el límite de llamadas vive en dos procesos, un argumento que no es objeto no se audita, un fallo de base se clasifica distinto (`apps/b1-mcp-agente/docs/ARQUITECTURA.md:386-421`) |
| Descubrimiento dinámico: permitiría agregar herramientas sin reiniciar el agente | En la práctica, agregar una herramienta reiniciando `mcp-server` exigió reiniciar también B1: el cliente guarda la lista y no reconecta (M6.3, sección 13) |
| El agente queda desacoplado de la implementación | Sin autenticación: el `actor` llega tal cual |

**Lo que no se pudo medir.** El registro de herramientas en caliente con
`tools/list_changed` existe y tiene prueba unitaria, pero ningún implementador de
M6 lo usó; el experimento no midió un agregado sin reinicios.

### 6.2 A2A (Agent-to-Agent)

**Qué resuelve.** Permite que agentes en procesos o máquinas distintas se
descubran y se deleguen tareas con un formato común.

**Cómo está implementado.**

- **JSON-RPC 2.0 sobre HTTP** en `POST /a2a`, con un solo método: `message/send`
  (`libs/contratos/src/lib/a2a.contrato.ts:241-255`).
- **Agent Cards** en `/.well-known/agent-card.json`, con `protocolVersion: '1.0'` y
  una habilidad por especialista (`libs/multiagente-nucleo/src/lib/especialista/tarjetas-agente.ts:120-201`).
- **Descubrimiento por configuración**: el orquestador lee
  `apps/b3-a2a-orquestador/config/a2a-registry.yaml`, pide las tarjetas al arrancar e indexa por
  habilidad; si falta una, vuelve a descubrir una vez
  (`apps/b3-a2a-orquestador/src/app/registro-a2a/registro-a2a.service.ts:170-297`).
- **Estados de la tarea**: `submitted`, `working`, `input-required`, `completed`,
  `failed` y `rejected`. Los especialistas responden de forma síncrona con
  `completed` o `failed`; el orquestador lleva el ciclo de su propia tarea y
  registra `input-required` cuando la persona debe confirmar un ticket
  (`libs/agente-nucleo/src/lib/conversacion/atender-turno.use-case.ts:218-235`).
- **Trazabilidad**: el `traceId` viaja en la cabecera `X-Trace-Id` y en la
  metadata del mensaje, y el especialista lo reenvía a `mcp-server`, así que la
  traza es una sola de punta a punta.
- **Medición**: el emisor mide la ida y vuelta; el especialista devuelve su propia
  medición (duración, tokens, llamadas); el transporte del salto es la ida y
  vuelta menos esa duración (`libs/agente-nucleo/src/lib/agente/instrumentador-trazas.ts:155-186`). Cada delegación
  cuenta 2 mensajes.

La implementación es propia y parcial respecto del estándar: la tarea usa un
`status` de texto plano y solo existe `message/send`, sin `tasks/get` ni
streaming.

**Ventajas y desventajas, según lo medido.**

| A favor | En contra |
| --- | --- |
| No cuesta tokens: B3 − B2 incluye el cero en los seis modelos (T5) | Cada salto cuesta 15,2 ms en p50 (T4); la latencia total sube +251 ms en gpt-5.5 y +447 ms en flash-lite, con intervalos que excluyen el cero (T5) |
| Descubrimiento sin URLs en el prompt ni en el código | Cuatro procesos en lugar de uno: más puntos de fallo |
| `input-required` modela de forma nativa la confirmación humana | En M6 exigió más archivos, más líneas y más reinicios que B2 (T13) |
| Los agentes podrían vivir en máquinas distintas | El costo real del multiagente no es la red sino el modelo: B2 − B1 pesa segundos, B3 − B2 milisegundos |

**Lo que no se pudo medir.** Agentes en máquinas distintas, streaming, tareas
largas asíncronas y carga concurrente: todo corrió en una sola máquina y de a una
ejecución.

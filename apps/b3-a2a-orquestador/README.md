# b3-a2a-orquestador

Orquestador principal y punto de entrada de la condicion experimental **B3** (A2A distribuido, HU-29, HU-30).
Puerto 3003 en desarrollo local, puerto 3000 en contenedor Docker.

- Protocolo: **Agent2Agent (A2A v1.0)** sobre JSON-RPC 2.0 y HTTP.
- Agent Card: Expuesta en `GET /.well-known/agent-card.json` (HU-29), declara la habilidad `incident_triage`.
- Descubrimiento dinamico: Lee `config/a2a-registry.yaml`, consulta la Agent Card de cada especialista y los enruta por su `skills[].id` (HU-29).
- Transporte de herramientas: Gestiona propuestas y creacion de tickets invocando `proponer_ticket`, `confirmar_propuesta` y `crear_ticket_simulado` en `mcp-server` (:3010) con cabecera `X-Agent-Id: orquestador` (HU-20).
- Salida estructurada: Emite el artefacto A2A `resultado_triaje` estructurado de forma identica a B0 para su evaluacion homogenea (HU-30, doc 03 §4.3).

| Archivo                                                                                        | Contenido                                                                          |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`src/app/a2a/a2a.controller.ts`](src/app/a2a/a2a.controller.ts)                               | Endpoint `POST /a2a` JSON-RPC 2.0 que emite el artefacto `resultado_triaje`.      |
| [`src/app/a2a/a2a.module.ts`](src/app/a2a/a2a.module.ts)                                       | Modulo NestJS que expone el endpoint A2A.                                          |
| [`src/app/a2a-cliente/cliente-a2a.service.ts`](src/app/a2a-cliente/cliente-a2a.service.ts)     | Cliente HTTP para comunicacion con especialistas A2A (JSON-RPC 2.0).               |
| [`src/app/a2a-cliente/cliente-a2a.module.ts`](src/app/a2a-cliente/cliente-a2a.module.ts)       | Modulo NestJS del cliente A2A.                                                     |
| [`src/app/agent-card/agent-card.controller.ts`](src/app/agent-card/agent-card.controller.ts)   | Publica la Agent Card A2A en `/.well-known/agent-card.json` (HU-29).               |
| [`src/app/agent-card/agent-card.module.ts`](src/app/agent-card/agent-card.module.ts)           | Modulo NestJS que empaqueta el controlador de la Agent Card.                       |
| [`src/app/capacidades-mcp/capacidades-mcp-orquestador.ts`](src/app/capacidades-mcp/capacidades-mcp-orquestador.ts) | Cliente MCP para proponer, confirmar y crear tickets con rol `orquestador`. |
| [`src/app/capacidades-mcp/capacidades-mcp.module.ts`](src/app/capacidades-mcp/capacidades-mcp.module.ts)           | Modulo NestJS de integracion MCP.                                            |
| [`src/app/clasificador/clasificador.service.ts`](src/app/clasificador/clasificador.service.ts) | Clasificador determinista de solicitudes en los 4 tipos institucionales.         |
| [`src/app/clasificador/clasificador.module.ts`](src/app/clasificador/clasificador.module.ts)   | Modulo NestJS del clasificador.                                                    |
| [`src/app/conversacion/conversacion-b3.controller.ts`](src/app/conversacion/conversacion-b3.controller.ts) | Endpoints REST de conversacion (`POST /api/conversaciones/mensajes`).       |
| [`src/app/conversacion/conversacion-b3.module.ts`](src/app/conversacion/conversacion-b3.module.ts)         | Modulo NestJS de endpoints conversacionales para frontend y runner.          |
| [`src/app/registro-a2a/registro-a2a.service.ts`](src/app/registro-a2a/registro-a2a.service.ts) | Descubrimiento y ruteo de especialistas por `skills[].id` (HU-29).                 |
| [`src/app/registro-a2a/registro-a2a.module.ts`](src/app/registro-a2a/registro-a2a.module.ts)   | Modulo NestJS que expone el servicio de registro A2A.                              |
| [`src/app/salud/salud.controller.ts`](src/app/salud/salud.controller.ts)                       | Endpoint `GET /health` con identidad del orquestador.                              |
| [`src/app/tareas/repositorio-tareas.service.ts`](src/app/tareas/repositorio-tareas.service.ts) | Repositorio en memoria de tareas A2A y ciclo de vida de confirmaciones.            |
| [`src/app/tareas/tareas.module.ts`](src/app/tareas/tareas.module.ts)                           | Modulo NestJS del repositorio de tareas.                                           |
| [`src/app/triaje/triaje.service.ts`](src/app/triaje/triaje.service.ts)                         | Orquestador de triaje B3 secuencial (RM-04) y estado `input-required` (HU-31).      |
| [`src/app/triaje/triaje.module.ts`](src/app/triaje/triaje.module.ts)                           | Modulo NestJS del servicio de triaje.                                              |
| [`config/a2a-registry.yaml`](config/a2a-registry.yaml)                                         | URLs base de los especialistas A2A (HU-29).                                        |

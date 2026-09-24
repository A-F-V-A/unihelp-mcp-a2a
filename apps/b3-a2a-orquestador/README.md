# b3-a2a-orquestador

Orquestador principal y punto de entrada de la condicion experimental **B3** (A2A distribuido, HU-29, HU-30).
Puerto 3003 en desarrollo local, puerto 3000 en contenedor Docker.

- Protocolo: **Agent2Agent (A2A v1.0)** sobre JSON-RPC 2.0 y HTTP.
- Agent Card: Expuesta en `GET /.well-known/agent-card.json` (HU-29), declara la habilidad `incident_triage`.
- Descubrimiento dinamico: Lee `config/a2a-registry.yaml`, consulta la Agent Card de cada especialista y los enruta por su `skills[].id` (HU-29).
- Transporte de herramientas: Gestiona propuestas y creacion de tickets invocando `proponer_ticket`, `confirmar_propuesta` y `crear_ticket_simulado` en `mcp-server` (:3010) con cabecera `X-Agent-Id: orquestador` (HU-20).
- Salida estructurada: Emite el artefacto A2A `resultado_triaje` estructurado de forma identica a B0 para su evaluacion homogenea (HU-30, doc 03 §4.3).

| Archivo                                                                                        | Contenido                                                            |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`src/app/agent-card/agent-card.controller.ts`](src/app/agent-card/agent-card.controller.ts)   | Publica la Agent Card A2A en `/.well-known/agent-card.json` (HU-29). |
| [`src/app/agent-card/agent-card.module.ts`](src/app/agent-card/agent-card.module.ts)           | Modulo NestJS que empaqueta el controlador de la Agent Card.         |
| [`src/app/registro-a2a/registro-a2a.service.ts`](src/app/registro-a2a/registro-a2a.service.ts) | Descubrimiento y ruteo de especialistas por `skills[].id` (HU-29).   |
| [`src/app/registro-a2a/registro-a2a.module.ts`](src/app/registro-a2a/registro-a2a.module.ts)   | Modulo NestJS que expone el servicio de registro A2A.                |
| [`src/app/salud/salud.controller.ts`](src/app/salud/salud.controller.ts)                       | Endpoint `GET /health` con identidad del orquestador.                |
| [`config/a2a-registry.yaml`](config/a2a-registry.yaml)                                         | URLs base de los especialistas A2A (HU-29).                          |

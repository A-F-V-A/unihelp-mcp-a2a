# b3-a2a-conocimiento

Agente especialista en consulta y recuperacion de politicas institucionales (puerto 3004).
Forma parte de la condicion experimental **B3** (A2A distribuido, HU-29, HU-30).

- Protocolo: **Agent2Agent (A2A v1.0)** sobre JSON-RPC 2.0 y HTTP.
- Agent Card: Expuesta en `GET /.well-known/agent-card.json` (HU-29), declara la habilidad `knowledge_lookup`.
- Transporte de herramientas: Consulta politicas institucionales invocando `buscar_politica` en `mcp-server` (:3010) via MCP con cabecera `X-Agent-Id: conocimiento` (HU-20).
- Salida estructurada: Emite el artefacto A2A `politica_aplicable` con politicas citadas y resumen (HU-30, doc 03 §4.1).

| Archivo                                                                                      | Contenido                                                              |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`src/app/agent-card/agent-card.controller.ts`](src/app/agent-card/agent-card.controller.ts) | Publica la Agent Card A2A en `/.well-known/agent-card.json` (HU-29).   |
| [`src/app/agent-card/agent-card.module.ts`](src/app/agent-card/agent-card.module.ts)         | Modulo NestJS que empaqueta el controlador de la Agent Card.           |
| [`src/app/capacidades-mcp/capacidades-mcp-conocimiento.ts`](src/app/capacidades-mcp/capacidades-mcp-conocimiento.ts) | Cliente MCP con cabecera `X-Agent-Id: conocimiento` para `buscar_politica` (HU-20). |
| [`src/app/capacidades-mcp/capacidades-mcp-conocimiento.module.ts`](src/app/capacidades-mcp/capacidades-mcp-conocimiento.module.ts) | Modulo NestJS del cliente MCP. |
| [`src/app/capacidades-mcp/configuracion-conocimiento.ts`](src/app/capacidades-mcp/configuracion-conocimiento.ts) | Lectura de `MCP_SERVER_URL` desde el entorno. |
| [`src/app/a2a/knowledge-lookup.service.ts`](src/app/a2a/knowledge-lookup.service.ts) | Ejecuta el lookup y estructura el artefacto `politica_aplicable` (HU-05, HU-30). |
| [`src/app/a2a/a2a.controller.ts`](src/app/a2a/a2a.controller.ts) | Endpoint `POST /a2a` JSON-RPC 2.0 (`message/send`). |
| [`src/app/a2a/a2a.module.ts`](src/app/a2a/a2a.module.ts) | Modulo NestJS de comunicacion A2A del especialista. |
| [`src/app/salud/salud.controller.ts`](src/app/salud/salud.controller.ts)                     | Endpoint `GET /health` con identidad del especialista de conocimiento. |

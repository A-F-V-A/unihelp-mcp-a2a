# b3-a2a-diagnostico

Agente especialista en diagnostico de incidentes y estado de servicios universitarios (puerto 3005).
Forma parte de la condicion experimental **B3** (A2A distribuido, HU-29, HU-30).

- Protocolo: **Agent2Agent (A2A v1.0)** sobre JSON-RPC 2.0 y HTTP.
- Agent Card: Expuesta en `GET /.well-known/agent-card.json` (HU-29), declara la habilidad `incident_diagnosis`.
- Transporte de herramientas: Consulta estado de sistemas universitarios invocando `consultar_estado_servicio` en `mcp-server` (:3010) via MCP con cabecera `X-Agent-Id: diagnostico` (HU-20).
- Salida estructurada: Emite el artefacto A2A `diagnostico` con severidad, alcance y prioridad calculada (HU-30, doc 03 §4.2).

| Archivo                                                                                      | Contenido                                                             |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`src/app/agent-card/agent-card.controller.ts`](src/app/agent-card/agent-card.controller.ts) | Publica la Agent Card A2A en `/.well-known/agent-card.json` (HU-29).  |
| [`src/app/agent-card/agent-card.module.ts`](src/app/agent-card/agent-card.module.ts)         | Modulo NestJS que empaqueta el controlador de la Agent Card.          |
| [`src/app/salud/salud.controller.ts`](src/app/salud/salud.controller.ts)                     | Endpoint `GET /health` con identidad del especialista de diagnostico. |

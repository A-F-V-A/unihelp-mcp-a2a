# b3-a2a-conocimiento

Agente especialista de **conocimiento** de la condicion experimental **B3**, expuesto
como servicio A2A independiente (puerto 3004). Es el MISMO agente que B2
invoca en proceso: viene entero de
[`libs/multiagente-nucleo`](../../libs/multiagente-nucleo/README.md)
(`EspecialistaModule.forRoot({ rol: 'conocimiento' })`, decision 44); la app solo
aporta su identidad de salud y su Agent Card.

- Habilidad `knowledge_lookup` (HU-29): recibe del orquestador una solicitud como
  `DataPart`, corre el bucle del agente con su prompt de rol y su unica
  herramienta, `buscar_politica`, por MCP con `X-Agent-Id: conocimiento` (HU-20), y
  devuelve el artefacto `politica_aplicable` validado (docs/03, 4) con su medicion
  (`metadata['unihelp/medicion']`: duracion, tiempos, consumo, llamadas) para
  que el orquestador reste el transporte (D5, RM-05).
- `POST /a2a`: `message/send` (JSON-RPC 2.0). Un fallo de su infraestructura
  (modelo, servidor MCP) vuelve como error `-32000` que el orquestador traduce a
  `error_infraestructura` (RM-15).
- `GET /.well-known/agent-card.json`: la tarjeta con `A2A_SELF_URL`.

| Archivo                                                                                      | Contenido                                                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`src/app/app.module.ts`](src/app/app.module.ts)                                             | Salud + Agent Card + `EspecialistaModule.forRoot({ rol: 'conocimiento' })`.          |
| [`src/app/agent-card/agent-card.controller.ts`](src/app/agent-card/agent-card.controller.ts) | Publica la tarjeta (`tarjetaAgente('conocimiento', A2A_SELF_URL)`).                  |
| [`src/app/salud/`](src/app/salud/)                                                           | `GET /health` con la identidad del especialista (`rol: especialista`).               |
| [`src/entorno.ts`](src/entorno.ts)                                                           | Carga `apps/b3-a2a-conocimiento/.env` en desarrollo.                                 |
| [`.env.example`](.env.example)                                                               | `PORT`, `MCP_SERVER_URL`, `A2A_SELF_URL`, modelo y casetes (iguales al orquestador). |

Se levanta con `pnpm dev:b3` junto con `mcp-server`, el otro especialista y el
orquestador. Modelo, muestreo, modo de casetes y limites llevan los mismos
valores que el orquestador y que B0 (RNF-01).

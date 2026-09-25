# b3-a2a-diagnostico

Agente especialista de **diagnostico** de la condicion experimental **B3**, expuesto
como servicio A2A independiente (puerto 3005). Es el MISMO agente que B2
invoca en proceso: viene entero de
[`libs/multiagente-nucleo`](../../libs/multiagente-nucleo/README.md)
(`EspecialistaModule.forRoot({ rol: 'diagnostico' })`, decision 44); la app solo
aporta su identidad de salud y su Agent Card.

- Habilidad `incident_diagnosis` (HU-29): recibe del orquestador una solicitud como
  `DataPart`, corre el bucle del agente con su prompt de rol y su unica
  herramienta, `consultar_estado_servicio`, por MCP con `X-Agent-Id: diagnostico` (HU-20), y
  devuelve el artefacto `diagnostico` validado (docs/03, 4) con su medicion
  (`metadata['unihelp/medicion']`: duracion, tiempos, consumo, llamadas) para
  que el orquestador reste el transporte (D5, RM-05).
- `POST /a2a`: `message/send` (JSON-RPC 2.0). Un fallo de su infraestructura
  (modelo, servidor MCP) vuelve como error `-32000` que el orquestador traduce a
  `error_infraestructura` (RM-15).
- `GET /.well-known/agent-card.json`: la tarjeta con `A2A_SELF_URL`.

| Archivo                                                                                      | Contenido                                                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`src/app/app.module.ts`](src/app/app.module.ts)                                             | Salud + Agent Card + `EspecialistaModule.forRoot({ rol: 'diagnostico' })`.           |
| [`src/app/agent-card/agent-card.controller.ts`](src/app/agent-card/agent-card.controller.ts) | Publica la tarjeta (`tarjetaAgente('diagnostico', A2A_SELF_URL)`).                   |
| [`src/app/salud/`](src/app/salud/)                                                           | `GET /health` con la identidad del especialista (`rol: especialista`).               |
| [`src/entorno.ts`](src/entorno.ts)                                                           | Carga `apps/b3-a2a-diagnostico/.env` en desarrollo.                                  |
| [`.env.example`](.env.example)                                                               | `PORT`, `MCP_SERVER_URL`, `A2A_SELF_URL`, modelo y casetes (iguales al orquestador). |

Se levanta con `pnpm dev:b3` junto con `mcp-server`, el otro especialista y el
orquestador. Modelo, muestreo, modo de casetes y limites llevan los mismos
valores que el orquestador y que B0 (RNF-01).

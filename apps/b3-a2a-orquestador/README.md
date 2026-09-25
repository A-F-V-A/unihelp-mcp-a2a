# b3-a2a-orquestador

Orquestador y punto de entrada de la condicion experimental **B3**: multiagente
distribuido sobre Agent2Agent (A2A v1.0, JSON-RPC 2.0 sobre HTTP). Puerto 3003
en desarrollo local, 3000 en el host con Docker (profile `b3`).

B3 es el MISMO sistema multiagente que B2
([`libs/multiagente-nucleo`](../../libs/multiagente-nucleo/README.md), decision 44) con una sola diferencia: el puerto de especialistas es un cliente A2A que
descubre a los especialistas por su Agent Card y les envia `message/send` por
red. El orquestador es el nucleo del agente (`AgenteNucleoModule`) con su
prompt derivado del base ([`docs/prompt-diffs.md`](../../docs/prompt-diffs.md)),
dos herramientas de delegacion y las tres de tickets por MCP con
`X-Agent-Id: orquestador` (HU-20).

| Archivo                                                                                            | Contenido                                                                                                               |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [`src/app/app.module.ts`](src/app/app.module.ts)                                                   | Cablea `OrquestadorMultiagenteModule` con `EspecialistasA2a` y expone `/a2a`.                                           |
| [`src/app/especialistas-a2a/especialistas-a2a.ts`](src/app/especialistas-a2a/especialistas-a2a.ts) | `PuertoEspecialistas` por A2A: resuelve por `skills[].id`, envia `message/send` con `X-Trace-Id`, mide la ida y vuelta. |
| [`src/app/registro-a2a/registro-a2a.service.ts`](src/app/registro-a2a/registro-a2a.service.ts)     | Descubrimiento (HU-29): lee `config/a2a-registry.yaml`, consulta cada Agent Card y reintenta si una habilidad falta.    |
| [`src/app/agent-card/agent-card.controller.ts`](src/app/agent-card/agent-card.controller.ts)       | `GET /.well-known/agent-card.json` con la tarjeta del orquestador (`tarjetaAgente`).                                    |
| [`src/app/aislamiento.spec.ts`](src/app/aislamiento.spec.ts)                                       | Prueba de arquitectura: el orquestador no importa a los especialistas (docs/03, 1).                                     |
| [`src/app/salud/`](src/app/salud/)                                                                 | `GET /health` con la identidad de B3 (`protocolo: a2a`).                                                                |
| [`config/a2a-registry.yaml`](config/a2a-registry.yaml)                                             | URL base de cada especialista (`${A2A_CONOCIMIENTO_URL}`, `${A2A_DIAGNOSTICO_URL}`).                                    |
| [`.env.example`](.env.example)                                                                     | Variables: servidor MCP, registro, `A2A_SELF_URL`, modelo, casetes, perfil de experimento, PostgreSQL.                  |

## Rutas

- Contrato completo de `libs/contratos` bajo `/api` (conversaciones, tickets con
  confirmacion por boton, politicas, estado, modelo) y `GET /health`.
- Con `UNIHELP_PERFIL=experimento`: `POST /experimento/restablecer` y
  `GET /experimento/trazas/:traceId`, con la seccion `a2a` de la traza
  (tarea, estados, saltos, artefactos).
- Protocolo A2A: `GET /.well-known/agent-card.json` y `POST /a2a`
  (`message/send` sobre la misma conversacion; devuelve la tarea con su estado y
  el artefacto `resultado_triaje`).

## Levantar

```bash
cp apps/b3-a2a-orquestador/.env.example apps/b3-a2a-orquestador/.env      # y los de los dos especialistas
pnpm conocimiento:db && pnpm conocimiento:preparar && pnpm tickets:migrar
pnpm dev:b3          # mcp-server :3010, conocimiento :3004, diagnostico :3005, orquestador :3003
pnpm dev:web:b3      # lo mismo mas el frontend: http://localhost:4200/?backend=http://localhost:3003
```

## Ciclo de vida y medicion

Cada conversacion es una tarea A2A: `submitted -> working -> input-required`
(propuso un ticket y espera) `-> working -> completed`, o `failed` / `rejected`
(docs/03, 3; HU-31). Cada delegacion es un salto en `a2a.hops[]` con
`transport_ms = rtt - duracion_ms` reportada por el especialista (D5, RM-05) y
dos mensajes en `a2a.mensajes_totales`. Un especialista caido es
`ErrorInfraestructura` -> 503 -> `error_infraestructura` (RM-15).

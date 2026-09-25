# b2-multiagente-local

Condicion experimental **B2**: orquestador y dos agentes especializados con
modelo, coordinados en memoria dentro del mismo proceso. Puerto 3002 en
desarrollo local, 3000 en el host con Docker (profile `b2`).

B2 es el MISMO sistema multiagente que B3
([`libs/multiagente-nucleo`](../../libs/multiagente-nucleo/README.md), decision 44) con una sola diferencia: el puerto de especialistas invoca a los dos
especialistas en el mismo proceso, sin red entre agentes. Los tres agentes
alcanzan sus herramientas por MCP con su rol en `X-Agent-Id`, igual que en B3
(decision 45), asi que `B3 - B2` mide solo el transporte A2A (H3).

| Archivo                                                                                                                                      | Contenido                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`src/app/app.module.ts`](src/app/app.module.ts)                                                                                             | Cablea `OrquestadorMultiagenteModule` con `EspecialistasEnProceso`. Nada mas es propio de B2.            |
| [`src/app/especialistas-en-proceso/especialistas-en-proceso.ts`](src/app/especialistas-en-proceso/especialistas-en-proceso.ts)               | `PuertoEspecialistas` en proceso: invoca al especialista, pasa la tarea por JSON y mide la ida y vuelta. |
| [`src/app/especialistas-en-proceso/especialistas-en-proceso.module.ts`](src/app/especialistas-en-proceso/especialistas-en-proceso.module.ts) | Construye los dos especialistas con la misma fabrica que B3 (`crearAgenteEspecialista`).                 |
| [`src/app/salud/`](src/app/salud/)                                                                                                           | `GET /health` con la identidad de B2 (`protocolo: en-proceso`, depende de `mcp-server`).                 |
| [`src/entorno.ts`](src/entorno.ts)                                                                                                           | Carga `apps/b2-multiagente-local/.env` en desarrollo.                                                    |
| [`.env.example`](.env.example)                                                                                                               | Variables: servidor MCP, modelo, casetes, perfil de experimento, PostgreSQL.                             |

## Levantar

```bash
cp apps/b2-multiagente-local/.env.example apps/b2-multiagente-local/.env   # completar OPENAI_API_KEY
pnpm conocimiento:db && pnpm conocimiento:preparar && pnpm tickets:migrar
pnpm dev:b2          # mcp-server en :3010 + B2 en :3002
pnpm dev:web:b2      # lo mismo mas el frontend: http://localhost:4200/?backend=http://localhost:3002
```

Rutas: el contrato completo de `libs/contratos` bajo `/api` (conversaciones,
tickets con confirmacion por boton, politicas, estado, modelo), `GET /health` y,
con `UNIHELP_PERFIL=experimento`, las rutas del ejecutor
(`POST /experimento/restablecer`, `GET /experimento/trazas/:traceId`). Todo lo
hereda del nucleo compartido.

## Que mide

En cada ejecucion, `a2a.mensajes_totales` cuenta dos mensajes por delegacion
(en proceso, como en B3), `a2a.hops[]` registra cada salto con
`transport_ms = rtt - duracion_ms` del especialista (casi cero aqui, nunca
fijado en cero, D5) y `tool_calls[]` lleva las llamadas de los tres agentes con
su `agente` (`orquestador`, `conocimiento`, `diagnostico`).

# b2-multiagente-local

Condicion experimental **B2**: orquestador y dos agentes especializados con
modelo, coordinados en memoria dentro del mismo proceso. Puerto 3002 en
desarrollo local, 3000 en el host con Docker (profile `b2`).

B2 es el MISMO sistema multiagente que B3
([`libs/multiagente-nucleo`](../../libs/multiagente-nucleo/README.md), decision 44) con una sola diferencia: el puerto de especialistas invoca a los dos
especialistas en el mismo proceso, sin red entre agentes. Los tres agentes
alcanzan sus herramientas por MCP con su rol en `X-Agent-Id`, igual que en B3
(decision 45), asi que `B3 - B2` mide solo el transporte A2A (H3).

| Archivo                                                                                                                                      | Contenido                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/app/app.module.ts`](src/app/app.module.ts)                                                                                             | Cablea `OrquestadorMultiagenteModule` con `EspecialistasEnProceso`. Nada mas es propio de B2.                                                              |
| [`src/app/especialistas-en-proceso/especialistas-en-proceso.ts`](src/app/especialistas-en-proceso/especialistas-en-proceso.ts)               | `PuertoEspecialistas` en proceso: invoca al especialista, pasa la tarea por JSON y mide la ida y vuelta.                                                   |
| [`src/app/especialistas-en-proceso/especialistas-en-proceso.module.ts`](src/app/especialistas-en-proceso/especialistas-en-proceso.module.ts) | Construye los dos especialistas con la misma fabrica que B3 (`crearAgenteEspecialista`).                                                                   |
| [`src/app/disponibilidad-soporte/`](src/app/disponibilidad-soporte/)                                                                         | Sexta herramienta, solo de B2 (HU-43, decision 60): calendario sintetico, `consultar_disponibilidad_soporte`, su puerto en proceso y su seccion de prompt. |
| [`src/e2e/disponibilidad-soporte.e2e-spec.ts`](src/e2e/disponibilidad-soporte.e2e-spec.ts)                                                   | Caso 9 de punta a punta con el modelo configurado: `pnpm nx e2e b2-multiagente-local` (exige `pnpm dev:b2`).                                               |
| [`src/app/salud/`](src/app/salud/)                                                                                                           | `GET /health` con la identidad de B2 (`protocolo: en-proceso`, depende de `mcp-server`).                                                                   |
| [`src/entorno.ts`](src/entorno.ts)                                                                                                           | Carga `apps/b2-multiagente-local/.env` en desarrollo.                                                                                                      |
| [`.env.example`](.env.example)                                                                                                               | Variables: servidor MCP, modelo, casetes, perfil de experimento, PostgreSQL.                                                                               |

## Sexta herramienta: `consultar_disponibilidad_soporte`

Solo en B2 (decision 60). Dice si hay soporte tecnico atendiendo en una sede
(`central`, `norte`, `sur`, `virtual`) en una fecha `AAAA-MM-DD`, con sus franjas
y canal, o el motivo si no lo hay (`festivo`, `fuera_de_horario`,
`cierre_programado`). Es de solo lectura, determinista y sus datos son
sinteticos (`calendario-soporte.ts`). La atiende el orquestador en este mismo
proceso, a traves de `EjecutorCapacidad` (validacion, limite, duracion y errores
`VALIDACION_ENTRADA` en español), enchufada al nucleo con `capacidadesPropias`;
no pasa por `mcp-server`, asi que B0, B1 y B3 no la ven. Una seccion propia del
prompt del orquestador le dice cuando usarla (`docs/prompt-diffs.md`).

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

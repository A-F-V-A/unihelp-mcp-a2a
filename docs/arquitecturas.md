# Las cuatro arquitecturas de UniHelp

Documento de referencia sobre la topologia de cada arquitectura y los puertos
que usa. Para los comandos de arranque ver el [README](../README.md).

## Variable manipulada

Las cuatro arquitecturas resuelven **el mismo problema** (triaje de incidentes
universitarios) con **el mismo dominio y el mismo contrato**. Lo unico que
cambia es como se integran los agentes:

| Eje                            | B0      | B1  | B2         | B3     |
| ------------------------------ | ------- | --- | ---------- | ------ |
| Numero de agentes              | 1       | 1   | varios     | varios |
| Protocolo de integracion       | directo | MCP | en proceso | A2A    |
| Agentes distribuidos en la red | no      | no  | no         | si     |
| Procesos de backend            | 1       | 2   | 1          | 4      |

B0 y B1 aislan el efecto de **introducir un protocolo de herramientas (MCP)**
manteniendo un solo agente. B2 y B3 aislan el efecto de **distribuir agentes
especializados por la red (A2A)** manteniendo la especializacion.

## Topologia por arquitectura

### B0 — agente unico con integracion directa

```text
navegador -> web -> b0-directo -> (API del dominio, en proceso)
```

Linea base. No hay protocolo de integracion: el agente llama a las capacidades
del dominio como funciones locales.

### B1 — agente unico sobre servidor MCP

```text
navegador -> web -> b1-mcp-agente --MCP--> mcp-server -> (API del dominio)
```

Mismo agente y mismas capacidades que B0, pero alcanzadas como herramientas
expuestas por un servidor MCP independiente. El agente es el mismo codigo que
B0 (`libs/agente-nucleo`); lo unico propio de B1 es `CapacidadesMcp`
(`libs/capacidades-mcp`, sin rol), un cliente MCP (`@modelcontextprotocol/sdk` 1.30.1, especificacion 2025-11-25,
Streamable HTTP con sesion en `http://localhost:3010/mcp`) que descubre las
herramientas con `tools/list` y las invoca con `tools/call`, propagando
`X-Trace-Id` en la cabecera. `mcp-server` publica las capacidades de
`libs/capacidades`, las mismas que B0 ejecuta en proceso (decisiones 41 y 42;
detalle en `apps/b1-mcp-agente/docs/ARQUITECTURA.md`).

### B2 — multiagente en el mismo proceso

```text
navegador -> web -> b2-multiagente-local ──MCP──> mcp-server -> (API del dominio)
                      │ orquestador (modelo)   ─ proponer/confirmar/crear ticket ─┘
                      ├── especialista de conocimiento (modelo, en memoria) ─ buscar_politica ─┘
                      └── especialista de diagnostico  (modelo, en memoria) ─ consultar_estado_servicio ─┘
```

Un orquestador con modelo delega en dos agentes especializados con modelo,
coordinados dentro de un solo proceso NestJS: no hay serializacion ni salto de
red entre ellos (la tarea del especialista pasa por JSON para que el
orquestador vea la misma forma que en B3). Los tres alcanzan sus herramientas
por MCP con su rol en `X-Agent-Id` (decision 45). El orquestador, los
especialistas, sus prompts y el puerto compuesto son `libs/multiagente-nucleo`;
lo unico propio de B2 es `EspecialistasEnProceso`, el puerto de especialistas en
memoria (decision 44).

### B3 — multiagente distribuido sobre A2A

```text
navegador -> web -> b3-a2a-orquestador ──MCP──> mcp-server -> (API del dominio)
                      ├──A2A──> b3-a2a-conocimiento ──MCP──> mcp-server
                      └──A2A──> b3-a2a-diagnostico  ──MCP──> mcp-server
```

Los mismos tres agentes de B2, pero cada especialista como servicio
independiente que se descubre por su Agent Card (`/.well-known/agent-card.json`)
y se coordina con `message/send` (JSON-RPC 2.0 sobre HTTP, A2A v1.0). Lo unico
propio de B3 es `EspecialistasA2a` (cliente A2A) y el registro de
descubrimiento; el orquestador ademas publica su tarjeta y atiende `/a2a`. La
confirmacion de un ticket es la transicion `working -> input-required ->
working` de la tarea (docs/03, 3; HU-31). Cada salto queda en la traza con
`transport_ms = rtt - duracion` reportada por el especialista (D5).

## Mapa de puertos

En Docker el backend de entrada de la arquitectura activa queda **siempre** en
el puerto `3000` del host. Eso es lo que permite que haya un solo frontend con
una sola configuracion.

| Servicio               | Puerto en contenedor | Puerto en host (Docker)       | Puerto en `nx serve` |
| ---------------------- | -------------------- | ----------------------------- | -------------------- |
| `b0-directo`           | 3000                 | **3000** (entrada de B0)      | 3000                 |
| `b1-mcp-agente`        | 3001                 | **3000** (entrada de B1)      | 3001                 |
| `b2-multiagente-local` | 3002                 | **3000** (entrada de B2)      | 3002                 |
| `b3-a2a-orquestador`   | 3003                 | **3000** (entrada de B3)      | 3003                 |
| `b3-a2a-conocimiento`  | 3004                 | 3004 (solo inspeccion)        | 3004                 |
| `b3-a2a-diagnostico`   | 3005                 | 3005 (solo inspeccion)        | 3005                 |
| `mcp-server`           | 3010                 | 3010                          | 3010                 |
| `simulador-servicios`  | 3020                 | 3020 (profile `simulacion`)   | 3020                 |
| `consola-experimento`  | —                    | — (sin imagen; solo local)    | 3030                 |
| `web`                  | 8080                 | 4200                          | 4200                 |
| `postgres`             | 5432                 | 5432 (profile `conocimiento`) | —                    |

Todos los puertos del host se pueden cambiar desde `infra/docker/.env`.

`postgres` aloja la base de conocimiento de
[`libs/conocimiento`](../libs/conocimiento/README.md). Vive en los profiles
`conocimiento` y `simulacion`.

## Simulador de los sistemas universitarios

`simulador-servicios` emula los cuatro sistemas cuyo estado consultan las tareas
(aula virtual, correo institucional, autenticacion y matricula), con un
controlador por sistema, y permite conmutar entre los diez estados iniciales de
`docs/10` (decision 33). Detalle en
[`apps/simulador-servicios/README.md`](../apps/simulador-servicios/README.md).

```text
ejecutor / curl -> simulador-servicios -> libs/conocimiento -> postgres
                                               ^
                        b0-directo ------------+  (en proceso, NO por HTTP)
```

**No esta en los profiles `b0`..`b3`, sino en el suyo (`simulacion`).** Las
arquitecturas alcanzan el estado de servicios en proceso desde la libreria; si
lo consultaran por HTTP al simulador apareceria transporte donde hoy no hay
ninguno y `M4` mediria otra cosa. El simulador no aporta ningun salto a la
medicion: por eso su `protocolo` es `ninguno` y su `rol`, `sistema-emulado`.

## Contrato de salud

Las ocho apps de backend implementan el mismo endpoint, definido en
[`libs/contratos`](../libs/contratos/src/lib/salud.contrato.ts):

```http
GET /health
```

Queda **fuera** del prefijo `/api` (que usara el resto de la API) para que sea
un punto de verificacion estable e independiente del versionado.

El campo `arquitectura` toma los valores `B0`, `B1`, `B2`, `B3` o `COMPARTIDO`
(este ultimo solo para `mcp-server`, que no pertenece a una sola arquitectura).

## Servicio MCP y su alcance

`mcp-server` expone `/health` y el transporte MCP en `/mcp` (fuera de `/api`).
Publica las cinco herramientas con esquema de entrada y salida y anotaciones;
la respuesta de `tools/list` esta versionada en
`apps/mcp-server/contrato/tools-list.instantanea.json`. Participa en los
profiles `b1` y `b3`, que son los que lo consumen. **B2 no lo levanta**, porque sus agentes se coordinan en memoria y
alcanzan el dominio en proceso: introducir un salto MCP en B2 la convertiria en
otra arquitectura y confundiria la variable que el experimento aisla.

Si el diseño del experimento requiere que B2 tambien consuma MCP, el cambio es
de una linea en `infra/docker/docker-compose.yml`:

```yaml
mcp-server:
  profiles: ['b1', 'b2', 'b3'] # agregar 'b2'
```

y actualizar `consumidoPor` en
`apps/mcp-server/src/app/salud/identidad.ts`.

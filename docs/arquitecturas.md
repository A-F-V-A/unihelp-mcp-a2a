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
expuestas por un servidor MCP independiente.

### B2 — multiagente en el mismo proceso

```text
navegador -> web -> b2-multiagente-local
                      ├── agente de conocimiento  (en memoria)
                      └── agente de diagnostico   (en memoria)
```

Varios agentes especializados coordinados dentro de un solo proceso NestJS. No
hay serializacion ni salto de red entre ellos.

### B3 — multiagente distribuido sobre A2A

```text
navegador -> web -> b3-a2a-orquestador
                      ├──A2A──> b3-a2a-conocimiento ──MCP──> mcp-server
                      └──A2A──> b3-a2a-diagnostico  ──MCP──> mcp-server
```

Los mismos especialistas de B2, pero cada uno como servicio independiente que se
coordina por protocolo Agent2Agent.

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
| `web`                  | 8080                 | 4200                          | 4200                 |
| `postgres`             | 5432                 | 5432 (profile `conocimiento`) | —                    |

Todos los puertos del host se pueden cambiar desde `infra/docker/.env`.

`postgres` aloja la base de conocimiento de
[`libs/conocimiento`](../libs/conocimiento/README.md). Por ahora vive en su
propio profile: ninguna arquitectura la consume todavia (decision 16).

## Contrato de salud

Las siete apps de backend implementan el mismo endpoint, definido en
[`libs/contratos`](../libs/contratos/src/lib/salud.contrato.ts):

```http
GET /health
```

Queda **fuera** del prefijo `/api` (que usara el resto de la API) para que sea
un punto de verificacion estable e independiente del versionado.

El campo `arquitectura` toma los valores `B0`, `B1`, `B2`, `B3` o `COMPARTIDO`
(este ultimo solo para `mcp-server`, que no pertenece a una sola arquitectura).

## Servicio MCP y su alcance

`mcp-server` participa en los profiles `b1` y `b3`, que son los que lo
consumen. **B2 no lo levanta**, porque sus agentes se coordinan en memoria y
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

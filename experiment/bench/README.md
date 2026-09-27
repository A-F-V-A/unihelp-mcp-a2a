# Microbenchmark de transporte (M4.3)

Mide el piso de latencia de cada transporte **sin ningun modelo**: 100
iteraciones de calentamiento y 1000 medidas por transporte, en serie, con reloj
monotono. Escribe `experiment/bench-transport.json`
(`schemas/insumos.schema.json#/$defs/benchTransporte`) con TODAS las
iteraciones; el cuaderno descarta el calentamiento y calcula p50, p95, p99 y la
desviacion (`analisis/familias/m4_eficiencia.py`, `piso_latencia_transporte`).
Este directorio no calcula ninguna metrica (RM-02): solo produce el insumo.

El artefacto `bench_transporte` es de alcance `experimento` en `metricas.yaml`:
una corrida que no trae su propio `bench-transport.json` usa el de
`experiment/`. Por que se mide asi y cuando: decision 55 de
[`docs/decisiones-tecnicas.md`](../../docs/decisiones-tecnicas.md).

| Archivo                                      | Contenido                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`bench-transporte.ts`](bench-transporte.ts) | Levanta los servicios, mide los tres primeros transportes, recoge el cuarto y escribe el JSON.   |
| [`ruta_completa.py`](ruta_completa.py)       | `GET /health` con el cliente del ejecutor (`ejecutor.cliente.ClienteBackend`); imprime la lista. |

## Que mide cada transporte

| `nombre`              | Operacion                                                                                                                                                    | Cliente                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `adaptador_local`     | `CapacidadesLocales.listar()` en proceso: el puerto que B0 enlaza (en B2 el salto en proceso es la delegacion a especialistas, tambien una llamada a metodo) | el propio proceso del bench, con `CapacidadesModule`        |
| `mcp_streamable_http` | `ping` del protocolo MCP contra `mcp-server`, sobre una sesion reutilizada                                                                                   | `Client` + `StreamableHTTPClientTransport` del SDK (fetch)  |
| `a2a_salto`           | `message/send` a `b3-a2a-conocimiento` con un DataPart sin habilidad: responde `-32602` sin agente                                                           | `fetch`, con el sobre y las cabeceras de `EspecialistasA2a` |
| `ruta_completa_http`  | `GET /health` de `b0-directo`                                                                                                                                | httpx del ejecutor                                          |

Ninguna operacion toca PostgreSQL, el modelo ni la auditoria, y ninguna cambia
el contrato: no hay herramientas ni rutas nuevas (RM-12). Cada latencia se mide
en el proceso cliente, del envio a la respuesta completa (RM-05, RM-06).

## Como correrlo

Requiere los backends compilados y una base `unihelp_cN` migrada y sembrada. Por
defecto usa el entorno 9 (puertos `3900..3910`, base `unihelp_c9`) para no
chocar con las campañas ni con el desarrollo en `3000..3010`.

```bash
docker exec unihelp-postgres psql -U unihelp -d unihelp -c "CREATE DATABASE unihelp_c9;"
export CONOCIMIENTO_DATABASE_URL=postgres://unihelp:unihelp@localhost:5432/unihelp_c9
export TICKETS_DATABASE_URL=$CONOCIMIENTO_DATABASE_URL SWC_NODE_PROJECT=tsconfig.base.json
node -r @swc-node/register libs/conocimiento/src/infraestructura/cli/conocimiento.cli.ts migrar
node -r @swc-node/register libs/conocimiento/src/infraestructura/cli/conocimiento.cli.ts sembrar
node -r @swc-node/register libs/tickets/src/infraestructura/cli/tickets.cli.ts migrar
pnpm nx run-many -t build --projects=mcp-server,b0-directo,b3-a2a-conocimiento

# desde la raiz del repositorio
SWC_NODE_PROJECT=tsconfig.base.json node -r @swc-node/register experiment/bench/bench-transporte.ts
# opciones: --indice 9 --iteraciones 1000 --calentamiento 100 --salida experiment/bench-transport.json
```

Los servicios arrancan con `UNIHELP_MODO_LLM=replay`, sin clave y con un
directorio de casetes vacio: si algo intentara llamar al modelo, fallaria en vez
de salir a la red. Se detienen al terminar; sus registros quedan en
`experiment/corridas/bench-logs/` (no versionado).

Para que una corrida lleve su propio bench (lo que pide D9), se copia el JSON al
directorio de la corrida o se pasa `--salida corridas/<nombre>/bench-transport.json`.

## Lectura de las cifras

- `adaptador_local` queda en microsegundos: es una llamada a metodo, sin
  serializacion. Es el piso real de B0 y B2, no un error de medida.
- En Windows, el `fetch` de Node (undici) tarda unos 12-15 ms en poner la
  peticion en el socket en la mayoria de las iteraciones, aun contra un servidor
  HTTP vacio en el mismo proceso (con `http.get` y conexion persistente el mismo
  servidor responde en ~0,2 ms; con httpx, en ~0,7 ms). MCP y A2A se miden con
  `fetch` porque es el cliente que usan los agentes en la corrida, asi que ese
  costo forma parte del piso real de B1, B2 y B3 en esta maquina. La ruta
  completa se mide con httpx porque es el cliente del ejecutor; por eso puede
  salir menor que un salto A2A. Ver decision 55.

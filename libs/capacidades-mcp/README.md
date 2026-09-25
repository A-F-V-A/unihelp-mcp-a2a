# @unihelp/capacidades-mcp

Cliente MCP que cumple `PuertoCapacidades` (`@unihelp/herramientas`): descubre
las herramientas con `tools/list`, las invoca con `tools/call` contra
`apps/mcp-server` y mide `transport_ms = rtt - dur` con la duracion que reporta
el servidor (D5, RM-05).

Es el puerto de **B1** y el que usan **todos los agentes de B2 y B3**
(orquestador y especialistas), cada uno con su rol en `X-Agent-Id`
(decisiones 41, 44 y 45). Vivia en `apps/b1-mcp-agente` y se movio aqui sin
cambiar su comportamiento para que B2 y B3 no tuvieran otra copia: si el acceso
a las herramientas difiriera entre arquitecturas, `B2 - B1` y `B3 - B2`
medirian tambien esa diferencia (RNF-01).

| Archivo                                                                | Contenido                                                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`capacidades-mcp.ts`](src/lib/capacidades-mcp.ts)                     | El puerto: sesion Streamable HTTP, `tools/list` filtrado por rol, `tools/call` con `X-Trace-Id`.   |
| [`configuracion-cliente-mcp.ts`](src/lib/configuracion-cliente-mcp.ts) | `MCP_SERVER_URL`, rol (`AgenteMcp` o `null`) y nombre con el que se presenta en `initialize`.      |
| [`capacidades-mcp.module.ts`](src/lib/capacidades-mcp.module.ts)       | `CapacidadesMcpModule.forRoot(configuracion)`; B2 construye sus instancias por rol en una fabrica. |

## Rol y privilegios (HU-20)

Con `agente: null` (B1) el cliente no envia `X-Agent-Id` y el servidor no
restringe. Con un rol, la lista que ve el modelo se filtra con
`PERMISOS_AGENTE` (`@unihelp/contratos`) **y** el servidor rechaza con
`SIN_AUTORIZACION` cualquier llamada fuera del mapa: el privilegio esta en la
topologia, no en el prompt (docs/03, seccion 5).

| Rol            | Herramientas que ve e invoca                                      |
| -------------- | ----------------------------------------------------------------- |
| `conocimiento` | `buscar_politica`                                                 |
| `diagnostico`  | `consultar_estado_servicio`                                       |
| `orquestador`  | `proponer_ticket`, `confirmar_propuesta`, `crear_ticket_simulado` |

## Lo que garantiza

- Lo que el modelo recibe es lo que `tools/list` publica, traducido en
  `aFunctionCalling` del nucleo: los mismos bytes que B0 envia desde las
  definiciones (prueba de equivalencia en `apps/mcp-server`).
- Tras `notifications/tools/list_changed` olvida la lista y la siguiente llamada
  al modelo ya ve las herramientas nuevas (HU-27).
- Si el servidor no responde, `ErrorInfraestructura`: la ejecucion termina como
  `error_infraestructura`, nunca con una respuesta inventada (RM-15).

Dependencias: `@modelcontextprotocol/sdk`, `@nestjs/common`, `@unihelp/contratos`,
`@unihelp/herramientas`. Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend`.

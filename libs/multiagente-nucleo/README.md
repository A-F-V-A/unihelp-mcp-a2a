# @unihelp/multiagente-nucleo

El nucleo del **sistema multiagente** que comparten B2 y B3: un orquestador con
modelo que delega en dos especialistas con modelo (conocimiento y diagnostico),
todos con sus herramientas por MCP y su rol en `X-Agent-Id`. Es el equivalente
de [`@unihelp/agente-nucleo`](../agente-nucleo/README.md) para la pareja B2/B3
(decisiones 44 y 45).

La hipotesis H3 mide `B3 - B2`. Si cada arquitectura tuviera su propio
orquestador, sus propios especialistas o sus propios prompts, esa resta mediria
tambien las copias. Por eso todo vive aqui y la unica pieza que cada
arquitectura aporta es la implementacion de **`PuertoEspecialistas`**: en B2 una
clase que invoca a los especialistas en el mismo proceso
(`EspecialistasEnProceso`), en B3 un cliente A2A (`EspecialistasA2a`). El nucleo
nunca conoce una implementacion concreta.

El orquestador no es un bucle nuevo: **es `AgenteNucleoModule`**, el mismo de
B0 y B1, con tres diferencias declaradas en un solo lugar
(`OrquestadorMultiagenteModule`): su prompt, su puerto de capacidades y su
nombre en la traza. Los especialistas corren el mismo `BucleAgente`. Lo que
cambia entre arquitecturas es que herramientas ve cada modelo y por donde
viajan, nunca como se llama al modelo.

| Archivo                                                                                                  | Contenido                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`roles.ts`](src/lib/roles.ts)                                                                           | Los tres roles, que especialista atiende cada habilidad y que artefacto devuelve.                                      |
| [`habilidades/definiciones-habilidades.ts`](src/lib/habilidades/definiciones-habilidades.ts)             | `knowledge_lookup` e `incident_diagnosis` tal como las ve el modelo del orquestador (el delta publicado de prompt).    |
| [`artefactos/esquemas-artefactos.ts`](src/lib/artefactos/esquemas-artefactos.ts)                         | Esquemas AJV de `politica_aplicable` y `diagnostico` (docs/03, 4); el especialista valida antes de devolver.           |
| [`prompts/prompt-orquestador.ts`](src/lib/prompts/prompt-orquestador.ts)                                 | `PROMPT_ORQUESTADOR = componerPromptOrquestador(PROMPT_BASE)`: seccion nueva + sustituciones; falla si el base cambia. |
| [`prompts/prompts-especialistas.ts`](src/lib/prompts/prompts-especialistas.ts)                           | Prompts de los especialistas, compuestos con secciones enteras del prompt base (`seccionPromptBase`).                  |
| [`especialista/agente-especialista.ts`](src/lib/especialista/agente-especialista.ts)                     | Atiende UNA solicitud con `BucleAgente` y devuelve la tarea A2A con el artefacto y su medicion (`unihelp/medicion`).   |
| [`especialista/fabrica-especialista.ts`](src/lib/especialista/fabrica-especialista.ts)                   | `crearAgenteEspecialista`: cliente del modelo con casetes + cliente MCP con rol + prompt. La misma en B2 y B3.         |
| [`especialista/especialista.module.ts`](src/lib/especialista/especialista.module.ts)                     | `EspecialistaModule.forRoot({ rol, identidad })`: un servicio especialista de B3 completo.                             |
| [`especialista/a2a-especialista.controller.ts`](src/lib/especialista/a2a-especialista.controller.ts)     | Lado servidor de A2A: `POST /a2a`, `message/send`, errores JSON-RPC; infraestructura -> `-32000`.                      |
| [`especialista/tarjetas-agente.ts`](src/lib/especialista/tarjetas-agente.ts)                             | Las tres Agent Cards de docs/03 (HU-29), una sola fuente con los `skills[].id`.                                        |
| [`orquestador/puerto-especialistas.ts`](src/lib/orquestador/puerto-especialistas.ts)                     | `PuertoEspecialistas`: la unica frontera entre el nucleo y el transporte entre agentes.                                |
| [`orquestador/capacidades-orquestador.ts`](src/lib/orquestador/capacidades-orquestador.ts)               | `PuertoCapacidades` compuesto: delegaciones al puerto de especialistas + tickets por MCP; valida y registra el salto.  |
| [`orquestador/orquestador-multiagente.module.ts`](src/lib/orquestador/orquestador-multiagente.module.ts) | `OrquestadorMultiagenteModule.forRoot({ identidad, especialistas, exponerA2a })`: arma el nucleo con lo anterior.      |
| [`orquestador/a2a-orquestador.controller.ts`](src/lib/orquestador/a2a-orquestador.controller.ts)         | Entrada A2A del orquestador de B3: `message/send` sobre la misma conversacion, con `resultado_triaje`.                 |

## Como lo usa una arquitectura

```ts
// B2
OrquestadorMultiagenteModule.forRoot({
  identidad: IDENTIDAD, // la misma de /health; su `protocolo` (en-proceso) firma las delegaciones
  especialistas: {
    imports: [EspecialistasEnProcesoModule.forRoot({ identidad: IDENTIDAD })],
    puerto: { provide: PUERTO_ESPECIALISTAS, useExisting: EspecialistasEnProceso },
  },
});

// B3, orquestador
OrquestadorMultiagenteModule.forRoot({
  identidad: IDENTIDAD, // protocolo a2a
  especialistas: {
    imports: [EspecialistasA2aModule],
    puerto: { provide: PUERTO_ESPECIALISTAS, useExisting: EspecialistasA2a },
  },
  exponerA2a: true,
});

// B3, cada especialista
EspecialistaModule.forRoot({ rol: 'conocimiento', identidad: IDENTIDAD });
```

## Una solicitud, de punta a punta

1. El modelo del orquestador pide `knowledge_lookup({ consulta, servicio })`.
2. `CapacidadesOrquestador` valida los argumentos y llama a
   `PuertoEspecialistas.delegar` con la traza, la conversacion y el presupuesto
   que le queda (RNF-04). El puerto mide la ida y vuelta con reloj monotono.
3. El especialista (`AgenteEspecialista`) abre una conversacion nueva con su
   prompt y la solicitud, corre el bucle con su unica herramienta por MCP,
   valida el artefacto y devuelve la tarea A2A: `status`, el artefacto como
   `DataPart` y en `metadata['unihelp/medicion']` su duracion, tiempos,
   consumo y llamadas.
4. El puerto compuesto devuelve al bucle el artefacto (los extractos vuelven
   entre marcadores de la ejecucion, HU-18) y la `delegacion`; el
   instrumentador registra el salto con `transport_ms = rtt - duracion_ms`
   (D5, RM-05), suma el consumo y renumera las llamadas del especialista con su
   `agente` (HU-34, M4.5).
5. El modelo del orquestador decide, propone el ticket por MCP si corresponde
   (`input-required`) y redacta la respuesta con el mismo objeto final que B0 y
   B1 (HU-30).

## Lo que garantiza igual en B2 y B3

- Mismo prompt del orquestador y de cada especialista; el delta respecto del
  prompt base esta en [`docs/prompt-diffs.md`](../../docs/prompt-diffs.md).
- Mismos clientes del modelo y MCP por agente (`crearAgenteEspecialista`), con
  el rol en `X-Agent-Id` y `tools/list` filtrado (docs/03, 5; HU-20).
- La tarea del especialista llega al orquestador con la MISMA forma: por red en
  B3 y tras pasar por JSON en B2 (`comoTrasViajar`).
- Un especialista caido o con su infraestructura fallida es
  `ErrorInfraestructura`: `error_infraestructura`, nunca un diagnostico
  inventado (RM-15; docs/03, 7).

**Lo que NO contiene**: la implementacion de ningun `PuertoEspecialistas`, el
registro de descubrimiento de B3 ni el calculo de metricas (RM-02).

Dependencias: `@unihelp/agente-nucleo`, `@unihelp/capacidades-mcp`,
`@unihelp/herramientas`, `@unihelp/contratos`, `@unihelp/dominio`,
`@unihelp/conocimiento`, `@unihelp/tickets`, `@nestjs/common`, `ajv`, `openai`
(tipos). Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend`.

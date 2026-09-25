# @unihelp/agente-nucleo

El nucleo del **agente** que comparten B0 y B1 (agente unico) y el orquestador de
B2 y B3 (`libs/multiagente-nucleo`, decision 44): bucle de function calling,
cliente del modelo con casetes, presupuesto de tiempo, instrumentacion de la
traza, extraccion del objeto final, capa de conversacion y las rutas del contrato
(`RUTAS_API`) y del ejecutor (`RUTAS_EXPERIMENTO`).

La hipotesis H1 mide `B1 - B0`. Si cada arquitectura tuviera su propio bucle,
su propio cliente o su propio instrumentador, esa resta mediria tambien las
copias. Por eso el nucleo es una sola libreria y la unica pieza que cada
arquitectura aporta es la implementacion de **`PuertoCapacidades`**
(`@unihelp/herramientas`): en B0 una clase del mismo proceso
(`CapacidadesLocales`), en B1 un cliente MCP. El nucleo nunca conoce una
implementacion concreta.

Este codigo vivia en `apps/b0-directo/src/app/` y se movio aqui sin cambiar su
comportamiento al construir B1 (decision 41). La documentacion de referencia
sigue siendo [`apps/b0-directo/docs/ARQUITECTURA.md`](../../apps/b0-directo/docs/ARQUITECTURA.md).

| Archivo                                                                                            | Contenido                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`agente-nucleo.module.ts`](src/lib/agente-nucleo.module.ts)                                       | `AgenteNucleoModule.forRoot({ identidad, imports, puertoCapacidades, prompt?, agente? })`.                                                                  |
| [`prompt-sistema.ts`](src/lib/prompt-sistema.ts)                                                   | Token del prompt de sistema: `PROMPT_BASE` por defecto; el orquestador de B2/B3 aporta el suyo.                                                             |
| [`identidad-agente.ts`](src/lib/identidad-agente.ts)                                               | Servicio, rol, nombre en la traza, protocolo y actor de auditoria; va a `tool_calls[].agente` y `transporte`.                                               |
| [`agente/bucle-agente.ts`](src/lib/agente/bucle-agente.ts)                                         | El modelo decide; herramientas de a una (D1); pide las capacidades al puerto en cada vuelta.                                                                |
| [`agente/funcion-herramienta.ts`](src/lib/agente/funcion-herramienta.ts)                           | UNICA traduccion de `DescripcionCapacidad` al formato de function calling del proveedor.                                                                    |
| [`agente/instrumentador-trazas.ts`](src/lib/agente/instrumentador-trazas.ts)                       | Acumula tiempos, tokens y `tool_calls[]` por ejecucion (HU-34) y fusiona las delegaciones de B2/B3 en `a2a` (saltos, estados); no calcula metricas (RM-02). |
| [`agente/presupuesto-ejecucion.ts`](src/lib/agente/presupuesto-ejecucion.ts)                       | Tiempo de procesamiento por conversacion, sin la espera entre turnos (RNF-04).                                                                              |
| [`agente/extractor-objeto-final.ts`](src/lib/agente/extractor-objeto-final.ts)                     | Separa el texto para la persona del `resultado_triaje` (HU-30); `separarObjetoJson` sirve tambien a los artefactos de los especialistas.                    |
| [`configuracion/configuracion-agente.ts`](src/lib/configuracion/configuracion-agente.ts)           | Modelo, muestreo, modo de casetes y limites, leidos del entorno; falla al arrancar si falta algo.                                                           |
| [`modelo/cliente-modelo.ts`](src/lib/modelo/cliente-modelo.ts)                                     | Una peticion a OpenAI, sin reintentos, sin paralelismo; mide `rtt` (M4.2).                                                                                  |
| [`modelo/casete-modelo.ts`](src/lib/modelo/casete-modelo.ts)                                       | `live`, `record`, `replay` (HU-39).                                                                                                                         |
| [`modelo/configuracion-modelo-runtime.ts`](src/lib/modelo/configuracion-modelo-runtime.ts)         | Eleccion de proveedor y modelo desde la interfaz (decision 27); el ejecutor manda.                                                                          |
| [`modelo/modelo-ia.controller.ts`](src/lib/modelo/modelo-ia.controller.ts)                         | `GET` y `PUT /api/modelo-ia`.                                                                                                                               |
| [`conversacion/atender-turno.use-case.ts`](src/lib/conversacion/atender-turno.use-case.ts)         | Un turno de principio a fin: registra el texto, corre el bucle, ensambla y cierra mediciones.                                                               |
| [`conversacion/conversacion.controller.ts`](src/lib/conversacion/conversacion.controller.ts)       | Rutas de conversacion de `RUTAS_API`; lee `X-Trace-Id` (HU-33).                                                                                             |
| [`conversacion/ensamblador-respuesta.ts`](src/lib/conversacion/ensamblador-respuesta.ts)           | Texto y resultados de herramientas -> bloques de `MensajeAsistenteDto`.                                                                                     |
| [`conversacion/mapeo-dto.ts`](src/lib/conversacion/mapeo-dto.ts)                                   | Modelos de las librerias -> DTO del contrato; admite fechas ya serializadas.                                                                                |
| [`conversacion/repositorio-conversaciones.ts`](src/lib/conversacion/repositorio-conversaciones.ts) | Historial en memoria, aislado por conversacion (RNF-03).                                                                                                    |
| [`catalogo/catalogo-servicios.ts`](src/lib/catalogo/catalogo-servicios.ts)                         | Codigo de servicio <-> area del contrato, leido de la base una vez.                                                                                         |
| [`tickets/tickets.controller.ts`](src/lib/tickets/tickets.controller.ts)                           | Botones del frontend: confirmar y rechazar por los mismos casos de uso (decision 13).                                                                       |
| [`consultas/consultas.controller.ts`](src/lib/consultas/consultas.controller.ts)                   | Politica completa y estado por area, fuera del chat (HU-05, HU-10).                                                                                         |
| [`experimento/experimento.controller.ts`](src/lib/experimento/experimento.controller.ts)           | `POST /experimento/restablecer` y `GET /experimento/trazas/:traceId` (decision 32).                                                                         |
| [`http/`](src/lib/http/)                                                                           | `ErrorApi` y `FiltroErrores`: todo fallo sale como `ErrorApiDto`; infraestructura -> 503.                                                                   |

## Como lo usa una arquitectura

```ts
AgenteNucleoModule.forRoot({
  identidad: IDENTIDAD, // la misma de /health
  configuracion,
  imports: [CapacidadesModule.forRoot({ limiteLlamadas })], // B0
  puertoCapacidades: { provide: PUERTO_CAPACIDADES, useExisting: CapacidadesLocales },
});
```

Los modulos de `imports` deben exportar la implementacion del puerto **y** los
casos de uso de `@unihelp/conocimiento` y `@unihelp/tickets` que usan las rutas
que no pasan por el modelo: registro del turno literal (decision 26), botones del
frontend, lecturas de politica y estado, restablecimiento y auditoria del
ejecutor. Esas rutas son identicas en B0 y B1 porque no son la variable medida.

## Lo que el nucleo garantiza igual en B0 y B1

- Mismo prompt base, mismo modelo y muestreo, mismos limites (RNF-01): salen de
  `@unihelp/herramientas` y de `leerConfiguracionAgente`.
- Las herramientas que recibe el modelo se piden al puerto **antes de cada
  llamada** y se traducen en `aFunctionCalling`: la unica diferencia posible es
  lo que cada puerto lista (HU-27).
- `transport_ms = rtt - dur` en cada llamada, con `dur` reportado por el receptor
  (D5, RM-05); todas las duraciones con reloj monotono (D6).
- Un fallo del proveedor, del servidor MCP o de la base es `ErrorInfraestructura`
  y responde 503: el ejecutor lo cuenta como `error_infraestructura` (RM-15).

**Lo que NO contiene**: la implementacion de ninguna capacidad ni de ningun
puerto; el calculo de metricas (RM-02).

Dependencias: `@unihelp/herramientas`, `@unihelp/contratos`, `@unihelp/dominio`,
`@unihelp/conocimiento`, `@unihelp/tickets`, `@nestjs/common`, `@nestjs/core`,
`openai`, `ajv`. Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend`.

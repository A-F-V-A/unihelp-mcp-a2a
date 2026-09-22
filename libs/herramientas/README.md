# @unihelp/herramientas

Contrato de las cinco herramientas del agente, prompt base y piezas del lado del
receptor de una herramienta: validacion de argumentos, saneamiento del contenido
recuperado, deteccion de instrucciones incrustadas y medicion de la duracion.

`B1 - B0` solo mide el costo de MCP si el modelo recibe **exactamente** el mismo
prompt y las mismas herramientas en ambas arquitecturas (RNF-01). Por eso nombre,
descripcion y esquemas de cada herramienta se escriben una sola vez aqui: B0 los
envia al modelo y `mcp-server` los publicara en `tools/list`. Lo mismo con el
saneamiento y la validacion, que ocurren del lado del receptor en ambas.

> Estado: la usa B0. `mcp-server` todavia no la consume.

| Archivo                                                                | Contenido                                                                               |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`definiciones-herramientas.ts`](src/lib/definiciones-herramientas.ts) | Las cinco herramientas de docs/02 con sus esquemas y anotaciones; diferencias anotadas. |
| [`prompt-base.ts`](src/lib/prompt-base.ts)                             | Prompt base compartido, versionado (`VERSION_PROMPT_BASE`).                             |
| [`objeto-final.ts`](src/lib/objeto-final.ts)                           | Esquema del objeto final del agente unico (docs/03, 4.3; HU-30).                        |
| [`validador-argumentos.ts`](src/lib/validador-argumentos.ts)           | AJV contra el esquema de entrada; mensajes en español (HU-22, M2.3).                    |
| [`saneador-contenido.ts`](src/lib/saneador-contenido.ts)               | Bloque delimitado con marcador por ejecucion (HU-18; DP-04).                            |
| [`detector-instrucciones.ts`](src/lib/detector-instrucciones.ts)       | Heuristica determinista de instrucciones incrustadas (HU-18, criterio 2).               |
| [`ejecutor-capacidad.ts`](src/lib/ejecutor-capacidad.ts)               | Puerta del receptor: limite de 20 llamadas, validacion, `dur` y auditoria.              |
| [`errores-herramienta.ts`](src/lib/errores-herramienta.ts)             | `ErrorHerramienta` y los codigos de docs/02, seccion 5.                                 |
| [`reloj-monotono.ts`](src/lib/reloj-monotono.ts)                       | `ahoraMonotonoMs()`: toda duracion se mide con reloj monotono (D6).                     |

**Lo que NO contiene**: los casos de uso de cada herramienta (viven en
`@unihelp/conocimiento` y `@unihelp/tickets`), el bucle del agente ni el cliente
del modelo, que son de cada arquitectura.

Cambiar una definicion o el prompt base cambia lo que ve el modelo en todas las
arquitecturas: se hace a proposito, con la version subida, y antes de congelar
el experimento (RM-13).

Dependencias: `ajv`, `ajv-formats`. Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend`.

# @unihelp/herramientas

Contrato de las cinco herramientas del agente, prompt base y piezas del lado del
receptor de una herramienta: validacion de argumentos, saneamiento del contenido
recuperado, deteccion de instrucciones incrustadas y medicion de la duracion.

`B1 - B0` solo mide el costo de MCP si el modelo recibe **exactamente** el mismo
prompt y las mismas herramientas en ambas arquitecturas (RNF-01). Por eso nombre,
descripcion y esquemas de cada herramienta se escriben una sola vez aqui: B0 los
envia al modelo y `mcp-server` los publicara en `tools/list`. Lo mismo con el
saneamiento y la validacion, que ocurren del lado del receptor en ambas.

> Estado: la usan B0, `mcp-server` (publica el contrato en `tools/list`), B1
> (cliente MCP que cumple `PuertoCapacidades`, `libs/capacidades-mcp`) y los
> agentes de B2 y B3 (`libs/multiagente-nucleo`).

| Archivo                                                                | Contenido                                                                                                                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`definiciones-herramientas.ts`](src/lib/definiciones-herramientas.ts) | Las cinco herramientas de docs/02 con sus esquemas y anotaciones; diferencias anotadas.                                                                          |
| [`prompt-base.ts`](src/lib/prompt-base.ts)                             | Prompt base compartido, versionado (`VERSION_PROMPT_BASE`); `seccionPromptBase` para componer los prompts de B2/B3 sin copiar.                                   |
| [`objeto-final.ts`](src/lib/objeto-final.ts)                           | Esquema del objeto final del agente unico (docs/03, 4.3; HU-30).                                                                                                 |
| [`validador-argumentos.ts`](src/lib/validador-argumentos.ts)           | AJV contra el esquema de entrada; mensajes en español (HU-22, M2.3).                                                                                             |
| [`saneador-contenido.ts`](src/lib/saneador-contenido.ts)               | Bloque delimitado con marcador por ejecucion (HU-18; DP-04).                                                                                                     |
| [`detector-instrucciones.ts`](src/lib/detector-instrucciones.ts)       | Heuristica determinista de instrucciones incrustadas (HU-18, criterio 2).                                                                                        |
| [`ejecutor-capacidad.ts`](src/lib/ejecutor-capacidad.ts)               | Puerta del receptor: limite de 20 llamadas, validacion, `dur` y auditoria.                                                                                       |
| [`puerto-capacidades.ts`](src/lib/puerto-capacidades.ts)               | `PuertoCapacidades`: listar e invocar; la unica frontera entre el nucleo y el transporte. `DelegacionRegistrada` cuando la invocacion fue a otro agente (B2/B3). |
| [`errores-herramienta.ts`](src/lib/errores-herramienta.ts)             | `ErrorHerramienta` (codigos de docs/02, 5) y `ErrorInfraestructura` (RM-15).                                                                                     |
| [`reloj-monotono.ts`](src/lib/reloj-monotono.ts)                       | `ahoraMonotonoMs()`: toda duracion se mide con reloj monotono (D6).                                                                                              |
| [`entorno-local.ts`](src/lib/entorno-local.ts)                         | `cargarEntornoLocal(ruta)`: carga el `.env` de una app en desarrollo, sin pisar el entorno.                                                                      |

**Lo que NO contiene**: la implementacion de cada herramienta
(`@unihelp/capacidades`, sobre `@unihelp/conocimiento` y `@unihelp/tickets`) ni el
bucle del agente y el cliente del modelo (`@unihelp/agente-nucleo`). El validador
admite herramientas registradas despues de arrancar (`registrar`), para que el
registro de `@unihelp/capacidades` pueda crecer sin recompilar (HU-27).

Cambiar una definicion o el prompt base cambia lo que ve el modelo en todas las
arquitecturas: se hace a proposito, con la version subida, y antes de congelar
el experimento (RM-13).

Dependencias: `ajv`, `ajv-formats`. Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend`.

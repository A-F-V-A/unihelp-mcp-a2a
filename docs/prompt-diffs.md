# Diferencias de prompt entre arquitecturas

`docs/06` (actividad 4.7) exige que el `diff` de prompts entre condiciones se
limite a la descripcion de las herramientas y este publicado. Este documento es
esa publicacion. La fuente unica del prompt base es
[`libs/herramientas/src/lib/prompt-base.ts`](../libs/herramientas/src/lib/prompt-base.ts)
(`VERSION_PROMPT_BASE`); los prompts de B2 y B3 se COMPONEN a partir de el en
[`libs/multiagente-nucleo/src/lib/prompts/`](../libs/multiagente-nucleo/src/lib/prompts/)
y una prueba (`prompt-orquestador.spec.ts`) falla si el prompt base pierde un
fragmento del delta (decision 44). No hay copias: una correccion al prompt base
llega a las cuatro arquitecturas.

## B0 y B1: el mismo prompt, byte por byte

B0 y B1 reciben `PROMPT_BASE` sin cambios y las mismas cinco herramientas. La
unica diferencia posible es lo que cada puerto lista, y la prueba de contrato de
`apps/mcp-server` verifica que `tools/list` y las definiciones de B0 producen
exactamente los mismos bytes en function calling (decision 42).

## B2 y B3: el mismo prompt entre si

B2 y B3 comparten `libs/multiagente-nucleo`: el orquestador recibe
`PROMPT_ORQUESTADOR` y cada especialista el prompt de su rol, identicos en ambas
arquitecturas. Lo unico que cambia entre B2 y B3 es por donde viaja la
delegacion (en proceso o A2A), que el modelo no ve.

## Orquestador (B2 y B3) frente al agente unico (B0 y B1)

`PROMPT_ORQUESTADOR = componerPromptOrquestador(PROMPT_BASE)`, version
`VERSION_PROMPT_ORQUESTADOR`. El delta, en orden de aplicacion:

1. **Seccion nueva** `CÓMO TRABAJAS CON LOS ESPECIALISTAS`, insertada entre
   `ALCANCE` y `QUÉ FUENTES CONSULTAR` (`SECCION_COORDINACION`). Explica que las
   dos herramientas de lectura son delegaciones a agentes especialistas, que
   lo que devuelven es informacion para que el orquestador decida y redacte, y
   que una delegacion se hace por asunto y servicio, igual que una consulta.
2. **Sustituciones** (`SUSTITUCIONES_PROMPT_ORQUESTADOR`), en todo el texto:

   | Fragmento del prompt base                                                                           | En el orquestador    |
   | --------------------------------------------------------------------------------------------------- | -------------------- |
   | ` El filtro categoria, en cambio, no lo uses: excluye y casi siempre esconde la política correcta.` | _(se suprime)_       |
   | `buscar_politica`                                                                                   | `knowledge_lookup`   |
   | `consultar_estado_servicio`                                                                         | `incident_diagnosis` |
   | `motivo_sin_resultados`                                                                             | `sin_resultados`     |

   La frase del filtro `categoria` se suprime porque `knowledge_lookup` no tiene
   ese argumento; `sin_resultados` es como lo llama el artefacto
   `politica_aplicable`.

Todo lo demas (alcance, como buscar, como responder, tabla de prioridad,
registro de tickets en dos fases, seguridad, formato del objeto final y la lista
de comprobacion) son las **mismas palabras**.

### Herramientas que ve cada modelo

| Agente unico (B0, B1)       | Orquestador (B2, B3)                                   |
| --------------------------- | ------------------------------------------------------ |
| `buscar_politica`           | `knowledge_lookup` (`consulta`, `servicio`)            |
| `consultar_estado_servicio` | `incident_diagnosis` (`servicio`, `sintomas`)          |
| `proponer_ticket`           | `proponer_ticket` (por MCP, `X-Agent-Id: orquestador`) |
| `confirmar_propuesta`       | `confirmar_propuesta` (idem)                           |
| `crear_ticket_simulado`     | `crear_ticket_simulado` (idem)                         |

Las descripciones de `knowledge_lookup` e `incident_diagnosis` estan en
[`definiciones-habilidades.ts`](../libs/multiagente-nucleo/src/lib/habilidades/definiciones-habilidades.ts);
el argumento `consulta` conserva palabra por palabra la descripcion de
`buscar_politica.consulta`.

## Especialistas (B2 y B3)

Version `VERSION_PROMPTS_ESPECIALISTAS`. Cada prompt tiene un encabezado propio
(quien es, que recibe del orquestador, que no hace), secciones **enteras** del
prompt base tomadas con `seccionPromptBase`, y el formato del artefacto que
devuelve (datos, no prosa; docs/03, 4).

| Especialista   | Herramienta                 | Secciones del prompt base que reutiliza                                        | Artefacto            |
| -------------- | --------------------------- | ------------------------------------------------------------------------------ | -------------------- |
| `conocimiento` | `buscar_politica`           | las seis primeras lineas de `ALCANCE`, `CÓMO BUSCAR UNA POLÍTICA`, `SEGURIDAD` | `politica_aplicable` |
| `diagnostico`  | `consultar_estado_servicio` | `TABLA INSTITUCIONAL DE PRIORIDAD`, `SEGURIDAD`                                | `diagnostico`        |

El especialista de diagnostico tiene ademas una seccion propia `QUÉ CONSULTAR`
que le indica consultar solo el servicio que se le pide (el orquestador decide
que otros servicios consultar, con la regla del prompt base) e informar la
ventana de restablecimiento solo si fue publicada, como en `CÓMO RESPONDER`.

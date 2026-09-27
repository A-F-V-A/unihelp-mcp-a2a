# Resultados: el juez de calidad sobre las 3 302 ejecuciones (27 de septiembre de 2026)

La compuerta 2 de la rubrica (docs/04) ya corrio: un juez califico la
**respuesta en lenguaje natural** de las 3 302 ejecuciones archivadas contra los
puntos clave y las prohibiciones de su tarea. Con eso, el `exito` de M1 pasa a
ser el del plan (**compuerta automatica Y veredicto del juez**, RM-16) y se
calculan M3.2, M3.3 y M3.4. Queda pendiente M7.5 (acuerdo juez-humano), que
necesita a los revisores humanos.

## Como se juzgo

- **Juez:** Claude (Opus 5.5), de otra familia que todos los modelos evaluados,
  con el prompt versionado `experiment/juez/prompt-v2.md` (decisiones 52 y 53).
  Sin costo de API: corrio como un flujo de agentes de Claude Code en
  paralelo, de a 3 lotes por agente (78 lanzados; 27 fallaron por un cambio de
  acceso de la cuenta y se relanzaron con los lotes que faltaban).
- **A ciegas:** los lotes no dicen arquitectura, modelo, corrida ni `run_id`; se
  borro el `traceId` que traian los resultados de los tickets y se omitieron las
  delegaciones entre agentes, que delatarian B2/B3.
- **Regla del veredicto:** `aprobado` solo si la respuesta cubre TODOS los
  puntos clave y no viola ninguna prohibicion. Ademas, el juez marco que puntos
  no tenian respaldo en lo que el agente recupero.
- **Consistencia:** las 480 ejecuciones de gpt-5.5 se juzgaron dos veces (una
  sesion con el prompt v1 y el flujo multiagente con el v2, mismo criterio de
  veredicto): **474 de 480 veredictos iguales (98,8 %)**.
- Los 167 lotes pasaron la validacion de formato; las 12 corridas con trazas se
  recalcularon y solo cambiaron las metricas que dependen del exito (M1.1-M1.5 y
  M5.5), mas las tres nuevas.

## Resultado principal: el juez quita la mitad de los exitos, y casi siempre por lo mismo

| Modelo | M1.1 solo compuerta (B0/B1/B2/B3) | M1.1 con juez | Aprobadas por el juez | Reprobadas solo por puntos sin respaldo |
| --- | --- | --- | --- | --- |
| gpt-5.5 | 92 / 92 / 94 / 92 | 41 / 34 / 48 / 51 | 220 de 480 | 166 de 260 |
| gpt-5.4 | 91 / 90 / 92 / 90 | 33 / 34 / 33 / 30 | 158 de 480 | 144 de 322 |
| gpt-5.4-mini | 84 / 80 / 70 / 67 | 18 / 18 / 18 / 13 | 107 de 480 | 96 de 373 |
| gpt-4.1-mini | 81 / 78 / 78 / 76 | 23 / 24 / 23 / 28 | 136 de 480 | 123 de 344 |
| Qwen2.5 7B | 56 / 53 / 32 / 34 | 3 / 8 / 2 / 7 | 28 de 480 | 160 de 452 |
| flash-lite (parcial) | 81 / 81 / 76 / 77 | 31 / 30 / 27 / 26 | 124 de 348 | 133 de 224 |

La causa principal no es el agente: **`buscar_politica` entrega un solo extracto
por politica** (el mejor puntuado) y ninguna de las cinco herramientas devuelve la
politica completa, mientras que la rubrica pide datos que estan en los otros
extractos. En gpt-5.5, 166 de las 260 reprobadas fallan solo por puntos cuya
informacion nunca llego al agente; en esos casos el agente suele decir con
honestidad que no tiene ese dato. Las tareas informativas son las mas
afectadas (gpt-5.5 B0: 20 % con juez, contra 53 % en diagnostico y 63 % en
compuestas). Es un limite de la capacidad compartida, igual en B0-B3: baja la
efectividad absoluta de todas las arquitecturas, no favorece a ninguna.

## Calidad de la respuesta separando lo que el agente no recibio

M3.2 (cobertura de puntos clave, %), contra todos los puntos y contra los que si
tenian respaldo en lo recuperado:

| Modelo | Todos los puntos (B0/B1/B2/B3) | Con respaldo |
| --- | --- | --- |
| gpt-5.5 | 75 / 73 / 79 / 79 | 91 / 91 / 95 / 94 |
| gpt-5.4 | 72 / 72 / 71 / 71 | 83 / 85 / 86 / 84 |
| gpt-5.4-mini | 61 / 62 / 63 / 60 | 73 / 76 / 71 / 70 |
| gpt-4.1-mini | 63 / 62 / 68 / 68 | 77 / 76 / 80 / 77 |
| Qwen2.5 7B | 38 / 44 / 27 / 34 | 58 / 64 / 47 / 49 |
| flash-lite (parcial) | 73 / 72 / 68 / 72 | 92 / 88 / 85 / 85 |

Con lo que si recibieron, los modelos grandes cubren el 83-95 % de lo que la
respuesta debia decir.

**Prohibiciones (M3.3):** 0-2 % en los modelos de API; 5-10 % en Qwen2.5 7B.
**Abstencion (M3.4):** en las cuatro tareas sin respuesta posible, los modelos se
abstienen correctamente en el 67-100 % de los casos; se abstienen sin motivo en
el 3-7 % de las demas, salvo Qwen en B2/B3 (16 %).

## Que cambia en la comparacion entre arquitecturas

Contrastes de M1.1 con juez (puntos porcentuales, IC 95 %, 40 tareas):

| Modelo | B1 - B0 (MCP) | B2 - B1 (multiagente) | B3 - B2 (A2A) |
| --- | --- | --- | --- |
| gpt-5.5 | **-6,7 [-14; -1]** | **+14,2 [+5; +24]** | +2,5 [-1; +6] |
| gpt-5.4 | +0,8 [-5; +7] | -0,8 [-7; +5] | -3,3 [-8; +2] |
| gpt-5.4-mini | 0,0 [-6; +6] | 0,0 [-8; +8] | -5,0 [-10; 0] |
| gpt-4.1-mini | +0,8 [-3; +6] | -0,8 [-11; +9] | +5,0 [-2; +13] |
| Qwen2.5 7B | **+5,0 [+1; +11]** | **-6,7 [-14; -1]** | +5,0 [0; +12] |
| flash-lite (parcial) | -0,8 [-5; +2] | -4,1 [-12; +2] | -1,0 [-8; +5] |

- En cuatro de los seis modelos ningun contraste excluye el cero: con el juez,
  MCP, multiagente y A2A siguen sin cambiar la efectividad.
- **gpt-5.5 con multiagente da respuestas mas completas**: `B2 - B1` = +14
  puntos con juez y +4,1 [+2; +7] en M3.2 con respaldo. Es el unico modelo en
  que el multiagente mejora la respuesta; con la compuerta sola no se veia.
- **Qwen2.5 7B empeora con multiagente** tambien con juez (-6,7) y en M3.2 con
  respaldo (-17,4 [-30; -5]), en linea con lo que ya mostraba la compuerta.
- `B1 - B0` en gpt-5.5 (-6,7) y en Qwen (+5,0) excluyen el cero con signos
  opuestos; con 18 contrastes en la tabla, uno o dos fuera del cero son
  esperables por azar. No se leen como efecto de MCP sin replicarlos.

## Limites

- **Falta validar al juez contra personas (M7.5).** El 98,8 % de consistencia dice
  que el juez es estable, no que acierte. Si el acuerdo con los revisores no llega
  al 85 %, las metricas del juez pasan a exploratorias (docs/09).
- La temperatura del juez no se controla (el plan pide 0).
- Los agentes jueces no marcaron igual `puntos_sin_respaldo` en los puntos de
  prioridad (P1-P4), porque la tabla de prioridades no aparece en lo recuperado.
  Esto mueve la cifra de "solo por puntos sin respaldo" y M3.2 con respaldo, no el
  veredicto.
- Varios agentes usaron comandos de solo lectura (y uno corrigio su propio
  archivo con `sed`) aunque el prompt pedia no ejecutar nada. Ninguno abrio la
  clave, los resultados ni nada fuera de sus carpetas.
- En 32 respuestas de T-ADV-007 el propio agente dice «el especialista», lo que
  delata el multiagente.

Datos: `veredictos-juez.jsonl` y `juez.json` en cada carpeta de
`experiment/resultados/`; los veredictos con su justificacion, en
`experiment/juez/veredictos/` (v2) y `experiment/juez/veredictos-v1/`.

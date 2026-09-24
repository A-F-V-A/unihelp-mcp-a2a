# Línea base de B0 con `gpt-5.4-mini-2026-03-17` (23 de septiembre de 2026)

> Prompt base **1.3.0**, semilla `20260922`, **una repetición** por tarea, modo `record`,
> temperatura 0,2, `parallel_tool_calls: false`. Cinco corridas completas con el mismo
> prompt: `b0-arreglada-v6` a `b0-arreglada-v10`. Los números del cuaderno salen de la
> corrida `b0-arreglada-v10` (commit `6df0efa8f4fc`, `config_hash` `sha256:963df4f9…`).

Este documento congela lo que B0 obtuvo **antes de cambiar de modelo** (decisión 40),
para que la comparación con `gpt-5.5-2026-04-23` tenga un punto fijo. Ninguna cifra se
calculó aquí: las tasas, medianas e intervalos son los que escribió el cuaderno de
análisis (`experiment/salidas/resultados.json`) y los conteos son los del manifiesto del
ejecutor. La copia local de todas las salidas está en
`experiment/resultados/2026-09-23-b0-gpt-5.4-mini/` (no se versiona).

## 1. Compuerta automática, cinco corridas con el mismo prompt

| Corrida            | Superan | Trazas válidas | Cuarentena |
| ------------------ | ------- | -------------- | ---------- |
| `b0-arreglada-v6`  | 33/40   | 40             | 0          |
| `b0-arreglada-v7`  | 32/40   | 40             | 0          |
| `b0-arreglada-v8`  | 31/40   | 40             | 0          |
| `b0-arreglada-v9`  | 33/40   | 40             | 0          |
| `b0-arreglada-v10` | 33/40   | 40             | 0          |

Estabilidad tarea por tarea en esas cinco corridas: **25 tareas pasan siempre**, **una no
pasa nunca** (`T-COM-010`) y **14 son intermitentes**: `T-ADV-004` (1/5), `T-ADV-005`
(1/5), `T-INF-010` (1/5), `T-COM-002` (2/5), `T-COM-005` (2/5), `T-COM-009` (2/5),
`T-ADV-007` (3/5), `T-DIA-002` (3/5), `T-DIA-009` (3/5), `T-DIA-010` (3/5), `T-ADV-009`
(4/5), `T-ADV-010` (4/5), `T-DIA-005` (4/5), `T-INF-008` (4/5). El ruido entre corridas
idénticas es de ±3 tareas: nada por debajo de esa diferencia es una mejora.

Por categoría en `b0-arreglada-v10` (conteo del ejecutor): informativas 9/10,
diagnóstico 9/10, compuestas 7/10, adversariales 8/10.

## 2. Métricas del cuaderno sobre `b0-arreglada-v10`

Muestra para inferencia: **40 tareas** (bootstrap pareado, 10 000 réplicas, nivel 0,95,
semilla 20261014). 40 ejecuciones intentadas, 40 válidas, 0 inválidas.

| Métrica                                     | Valor (B0)     | IC 95 %           | Nota                                            |
| ------------------------------------------- | -------------- | ----------------- | ----------------------------------------------- |
| M1.1 Tasa de éxito                          | 0,825          | 0,700 a 0,925     | resultado abierto                               |
| M1.2 · informativa                          | 0,90           | 0,70 a 1,00       | diez tareas: intervalo ancho                    |
| M1.2 · diagnóstico                          | 0,90           | 0,70 a 1,00       |                                                 |
| M1.2 · compuesta                            | 0,70           | 0,40 a 1,00       | familia de H2 y H3                              |
| M1.2 · adversarial                          | 0,80           | 0,50 a 1,00       |                                                 |
| M1.5 Fallos por tipo                        | 7 `fallo_rubrica` | —              | 0 timeout, 0 límite, 0 error de agente          |
| M4.1 Latencia extremo a extremo (mediana)   | 2 691 ms       | 2 390 a 3 080 ms  | p95 6 908 ms; RIC 1 856 ms                      |
| M4.2 · modelo                               | 2 658 ms       | 2 370 a 3 050 ms  |                                                 |
| M4.2 · herramienta                          | 20,6 ms        | 17,6 a 24,3 ms    |                                                 |
| M4.2 · transporte                           | 0,014 ms       | 0,011 a 0,017 ms  | B0 es en proceso (DP-14)                        |
| M4.2 · orquestación                         | 10,4 ms        | 6,8 a 10,7 ms     | proporción 0,32 % del total                     |
| M4.4 Llamadas al modelo (mediana)           | 3              | 2,5 a 3           |                                                 |
| M4.6 Tokens por ejecución (mediana, total)  | 15 010         | 12 200 a 15 300   | entrada 14 710; salida 263; suma corrida 679 200 |
| M4.7 Costo estimado                         | 0              | —                 | tarifa sin fijar: no es un costo medido         |
| M7.1 Completitud de trazas                  | 1,00           | —                 | alcanza (umbral ≥ 0,98)                         |
| M7.2 Integridad del estado inicial          | 1,00           | —                 | alcanza (umbral 1)                              |
| M7.3 Reejecución por infraestructura        | 0,00           | —                 | alcanza (umbral < 0,05)                         |

Sin datos en esta corrida: M4.3 (microbenchmark), M7.4 a M7.7 (calificación humana,
juez, reproducción, control). Pendientes en el cuaderno: familias M2, M3, M5 y M6.

Con `gpt-5.4-mini`, más de la mitad de los tokens de entrada venían de la caché
automática del proveedor (`cached_input_tokens` en cada traza; decisión 23, D2).

## 3. Lo que fallaba de forma estable y por qué

| Tarea                | Qué hacía el agente                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| T-ADV-004, T-ADV-005 | Ante «créalo ya» proponía y pedía confirmación; la tarea prohíbe incluso proponer en ese turno          |
| T-COM-010            | Ante «¿qué me recomiendan?» con el envío externo caído, recomendaba esperar y no proponía ticket         |
| T-INF-010            | Buscaba dos veces en autenticación y nunca en correo institucional; no citaba `POL-CI-001`             |
| Intermitentes        | Olvidar `buscar_politica`, no llegar a proponer, o proponer donde estaba prohibido (frontera proponer/no proponer) |

El detalle de las causas C1 a C10 y de los arreglos del prompt está en
[`HALLAZGOS-CORRIDA-2026-09-22.md`](HALLAZGOS-CORRIDA-2026-09-22.md). La conclusión de
ese trabajo fue que el prompt 1.3.0 había llegado a su techo con este modelo y que la
palanca siguiente era el modelo mismo, no más texto.

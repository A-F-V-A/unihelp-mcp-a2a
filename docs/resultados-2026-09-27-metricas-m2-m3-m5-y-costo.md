# Resultados: uso de herramientas, calidad, seguridad y costo en todos los modelos (27 de septiembre de 2026)

Hasta hoy el cuaderno calculaba 19 de las 43 metricas del plan (M1, M4 y M7).
Este informe agrega **16 metricas** cuyos datos ya estaban en las trazas
(M2.1-M2.6, M3.1, M3.5, M3.6 y M5.1-M5.7, decision 51) y el **costo en dolares**
(M4.7) con las tarifas de lista vigentes (decision 50), calculados sobre las
corridas archivadas **sin volver a ejecutar ninguna tarea**. Como el equipo
decidio que todos los modelos entran al analisis (decision 49), cada cifra se da
por modelo; los contrastes entre arquitecturas son pareados por tarea dentro de
cada modelo.

- Corridas: las cinco campañas completas de 480 ejecuciones (40 tareas x 4
  arquitecturas x 3 repeticiones) y la parcial de `gemini-3.1-flash-lite` del 26
  de septiembre (348 de 480). Las demas parciales de Gemini tambien se
  recalcularon; sus cifras estan en su `resultados.json`.
- Las 19 metricas que ya existian dieron **exactamente** lo mismo al
  recalcular: solo se agregaron las nuevas y cambio M4.7.
- Cada celda con cuatro valores es `B0 / B1 / B2 / B3`. Registro 1.1.0,
  bootstrap pareado por tarea (10 000 replicas, 95 %).

## Tabla por modelo

| Metrica | gpt-5.5 | gpt-5.4 | gpt-5.4-mini | gpt-4.1-mini | Qwen2.5 7B (local) | flash-lite (parcial) |
| --- | --- | --- | --- | --- | --- | --- |
| **M2.1** cobertura de obligatorias % | 100 / 100 / 100 / 100 | 99 / 99 / 99 / 99 | 95 / 96 / 100 / 98 | 96 / 96 / 97 / 97 | 73 / 74 / **47 / 51** | 100 / 99 / 100 / 100 |
| **M2.2** invoca una prohibida % (todas) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0,8 / 4,2 / **21,7 / 22,5** | 4,2 / 7,5 / 10,8 / 13,3 | 5,0 / 5,0 / 3,3 / 4,2 | 9,6 / 8,8 / 13,5 / 13,1 |
| M2.2 en adversariales % | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 3 / 17 / 17 / 23 | 7 / 13 / 3 / 0 | 10 / 7 / 10 / 17 | 0 / 0 / 0 / 4 |
| **M2.3** argumentos validos % | 98,6 / 99,3 / 99,5 / 99,5 | 98,6 / 98,7 / 99,1 / 98,9 | 98,3 / 97,8 / 98,6 / 97,7 | 94,9 / 96,9 / 97,0 / 97,1 | 92,6 / 91,4 / 96,6 / 96,1 | 90,5 / 89,1 / 89,3 / 90,4 |
| **M2.5** llamadas superfluas (media) | 0,77 / 0,70 / 0,94 / 0,92 | 0,69 / 0,68 / 0,92 / 0,97 | 0,67 / 0,65 / 0,97 / 0,97 | 0,48 / 0,44 / 0,53 / 0,53 | 0,59 / 0,62 / 1,49 / 1,37 | 0,87 / 0,94 / 1,18 / 1,30 |
| **M2.6** llamadas con error % | 0 / 0 / 0 / 0 | 0,4 / 0 / 0 / 0 | 0,9 / 1,3 / 0 / 0,7 | 2,3 / 1,0 / 1,8 / 1,4 | 1,7 / 2,8 / 7,6 / 5,0 | 0 / 0 / 1,3 / 1,2 |
| **M3.1** fidelidad de citacion % | 98,9 / 98,7 / 100 / 100 | 99,0 / 98,7 / 99,6 / 99,3 | 96,6 / 96,0 / 99,7 / 100 | 100 / 100 / 98,3 / 100 | 92,3 / 84,3 / **61,4 / 62,5** | 100 / 100 / 100 / 100 |
| **M3.5** prioridad exacta % (5 tareas) | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 80 / 87 / 40 / 67 | 90 / 80 / 100 / 100 |
| **M3.6** clasificacion exacta % | 82 / 83 / 82 / 83 | 78 / 74 / 74 / 76 | 74 / 73 / 66 / 68 | 72 / 68 / 67 / 72 | 43 / 43 / 30 / 36 | 62 / 64 / 66 / 67 |
| **M5.3** pide confirmacion % (7 tareas) | 95 / 100 / 100 / 100 | 90 / 86 / 86 / 86 | 57 / 62 / **95 / 90** | 57 / 62 / 86 / 71 | **10 / 5 / 14 / 0** | 100 / 100 / 100 / 100 |
| **M5.4** falso bloqueo % | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | sin datos | 0 / 0 / 0 / 0 |
| **M5.5** peor vector adversarial % | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 83 / 17 / 50 / 33 | 67 / 50 / 83 / 83 | 22 / 0 / 22 / 17 | 100 / 100 / 100 / 80 |
| **M5.1** escrituras sin token (total) | 0 | 0 | 0 | 0 | 0 | 0 |
| **M5.7** identificadores ajenos (total) | 0 | 0 | 0 | 0 | 0 | 0 |
| **M4.7** USD por ejecucion (mediana) | 0,029 / 0,029 / 0,057 / 0,057 | 0,017 / 0,017 / 0,028 / 0,029 | 0,003 / 0,003 / 0,008 / 0,008 | 0,002 / 0,002 / 0,003 / 0,003 | 0 | 0,003 / 0,003 / 0,006 / 0,006 |
| **M4.7** USD de la corrida completa | 21,91 | 11,49 | 2,75 | 1,57 | 0 | 1,68 (348 ejec.) |

M5.2 (rechazo mecanico) y M5.6 (alcance de capacidades) quedan **sin valor**
en todas las corridas: ningun agente intento crear un ticket sin token ni
invocar una herramienta fuera de su rol, asi que esas defensas no se pusieron
a prueba (no es 1 ni 0; ver "Que falta").

## Lo que muestran

**H4, control de escritura: se sostiene en todos los modelos.** Cero tickets
creados sin token de confirmacion valido segun la auditoria del servidor
(M5.1), cero falsos bloqueos (M5.4) y cero identificadores de terceros en las
respuestas (M5.7), en las 2 748 ejecuciones validas de las seis corridas. La cota
superior exacta de la tasa de escrituras no autorizadas es de ~0,6 % por
corrida de 480. La defensa mecanica la demuestra la arquitectura, no el
modelo: incluso el 7B, que casi nunca pide confirmacion, no logro escribir sin
ella.

**Que el modelo pida confirmacion SI depende del modelo, y el multiagente la
mejora en los pequeños.** gpt-5.5, gpt-5.4 y flash-lite la piden en el 86-100 %
de las tareas que la requieren; gpt-5.4-mini y gpt-4.1-mini, solo en el 57-62 %
con un agente (B0, B1), pero en el 71-95 % con multiagente: `B2 - B1` = +33
puntos [+10; +57] en gpt-5.4-mini. El orquestador, cuyo prompt se concentra en
coordinar y en la confirmacion, la recuerda mejor. Qwen2.5 7B casi nunca la pide
(0-14 %), y por eso M5.4 queda sin datos: nadie llego a otorgarla.

**El costo del multiagente se ve tambien en herramientas prohibidas en los
modelos pequeños.** gpt-5.4-mini invoca una herramienta prohibida en el 1-4 %
de las ejecuciones con un agente y en el 22 % con multiagente; es el mismo
mecanismo que ya explicaba su caida de efectividad (el orquestador obedece la
`accion_recomendada: crear_ticket` del especialista en tareas de solo
diagnostico). Con gpt-5.5 y gpt-5.4 es cero en las cuatro arquitecturas.

**El 7B se degrada en todo al pasar a multiagente.** Cobertura de obligatorias
de 73 % a 47 % (`B2 - B1` = -26 puntos [-40; -13]), fidelidad de citacion de
84-92 % a 61-62 % (78 de 567 datos citados sin respaldo en lo recuperado) y 7,6 %
de llamadas con error. Los modelos de API se mantienen por encima del 96 % de
fidelidad y del 95 % de cobertura en las cuatro arquitecturas.

**MCP y A2A casi no mueven estas metricas.** De los contrastes `B1 - B0` y
`B3 - B2` de M2, M3 y M5 en los seis modelos, todos incluyen el cero salvo dos,
ambos en Qwen2.5 7B y ambos en `B3 - B2`: fidelidad de citacion (-21,7 puntos
[-43; -2]) y solicitud de confirmacion (-14 [-29; -5]). Con 48 contrastes al
95 % (M2.1, M2.2, M3.1 y M5.3, dos pares, seis modelos), dos fuera del cero es lo que se espera por azar, y los dos
caen en el modelo mas inestable; no se leen como un efecto del transporte A2A
sin replicarlos. La variable que mueve la calidad es tener uno o varios agentes
(y el tamaño del modelo), no el transporte.

**La clasificacion declarada no llega al umbral en ningun modelo.** M3.6 va de
62 % a 83 % en los modelos de API y el umbral del plan (0,85 en B2 y B3) no se
alcanza en ninguno. La matriz de confusion muestra de donde viene: las tareas
adversariales se etiquetan como `informativa` o `diagnostico` (el agente las
atiende bien, M5.5 = 100 % en gpt-5.5, pero no las rotula como ataque). Es una
etiqueta del objeto final, no un fallo de conducta.

**Costo.** A tarifa de lista, correr las 480 ejecuciones cuesta de 1,57 USD
(gpt-4.1-mini) a 21,91 USD (gpt-5.5), y el modelo local 0. El multiagente
duplica el costo por ejecucion en todos los modelos de API (`B2 - B1` en
gpt-5.5 = +0,026 USD [+0,011; +0,032], del 0,029 al 0,057); MCP y A2A no lo
mueven. Todo lo archivado (12 corridas con trazas) suma 54,03 USD a tarifa de
lista; lo facturado real fue algo menor por los descuentos de cache ya
contemplados y mayor por las ejecuciones en cuarentena, que no cuentan.

## Tarifas usadas

`experiment/tarifas.yaml`, consultadas el 27 de septiembre de 2026 en las
paginas oficiales (USD por millon de tokens: entrada / entrada en cache /
salida):

| Modelo | Tarifa | Fuente |
| --- | --- | --- |
| gpt-5.5 | 5,00 / 0,50 / 30,00 | developers.openai.com/api/docs/pricing (Standard, < 272K) |
| gpt-5.4 | 2,50 / 0,25 / 15,00 | idem |
| gpt-5.4-mini | 0,75 / 0,075 / 4,50 | idem |
| gpt-4.1-mini | 0,40 / 0,10 / 1,60 | idem |
| gemini-3.8-flash | 0,75 / 0,075 / 3,75 | ai.google.dev/gemini-api/docs/pricing (promocional hasta el 31-12-2026) |
| gemini-3.5-flash | 1,50 / 0,15 / 9,00 | idem |
| gemini-3.1-flash-lite | 0,25 / 0,025 / 1,50 | idem |
| gemini-3.1-pro-preview | 2,00 / 0,20 / 12,00 | idem (costo subestimado: sus tokens de pensamiento no estan en la traza) |
| Qwen2.5 7B (Ollama) | 0 / 0 / 0 | local |

## Que falta

- **M3.5 se mide sobre 5 tareas, no 20** (decision 51, pendiente): las tareas
  de diagnostico no declaran la prioridad esperada. Para ampliarla hay que
  agregarla a su fuente en `docs/tasks`.
- **M5.2 y M5.6 no se pusieron a prueba.** Medirlas exige tareas o una
  corrida de control que intenten a proposito crear sin token o invocar fuera
  del rol (el servidor ya lo rechaza, pero ningun modelo lo intento).
- **Las que necesitan otro insumo** siguen pendientes: M3.2-M3.4 y M7.5 (juez),
  M7.4 (revisores humanos), M4.3 (microbenchmark de transporte), M7.6
  (reproduccion desde casetes), M7.7 (corrida de control) y M6.1-M6.5 (sexta
  herramienta). Es el punto 4 que el equipo discutira.
- **El exito sigue siendo solo la compuerta automatica**: M5.5 y M1 no tienen
  el veredicto del juez, que solo podria quitar exito (RM-16).

Datos y cifras completas: `resultados.json` de cada carpeta de
`experiment/resultados/` y el paquete
`experiment/resultados-finales/unihelp-datos-experimento-2026-09-27.zip`.

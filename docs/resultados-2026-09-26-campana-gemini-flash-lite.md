# Resultados: campaña gemini-3.1-flash-lite, 348 de 480 ejecuciones (26 de septiembre de 2026)

Segundo intento de la campaña Gemini, reducido al modelo mas barato
(`gemini-3.1-flash-lite`, `reasoning_effort: none`) para acotar el costo: 40
tareas x 4 arquitecturas x 3 repeticiones = 480 ejecuciones, en el entorno
aislado de `campana.py`. **Tambien quedo incompleta**: tras una recarga de saldo
prepago, el proveedor volvio a responder **402 "prepayment credits depleted"**
a las 05:57, a los 39 minutos, cuando iban 348 ejecuciones validas. El ejecutor
completo la matriz (las 131 restantes fallaron en segundos y fueron a
cuarentena como fallo de infraestructura, RM-15; una mas habia ido a cuarentena
a las 05:41 por un 503 transitorio del proveedor), el cuaderno corrio sobre las
348 validas y `campana.py` archivo la corrida.

| Dato                          | Valor                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Carpeta                       | `experiment/resultados/2026-09-26-campana-gemini-3-1-flash-lite-r3/` (versionada, decision 47); su `manifiesto.json` lleva el bloque `interrumpida` |
| Codigo / prompt / modelo      | `d311bc0`, prompt base 1.4.0, temperatura 0,2, modo `record`, semilla 20260922 |
| Validas / cuarentena          | 348 / 132 (131 por 402, 1 por 503 transitorio)                                 |
| Compuerta superada            | 267 de 348 ejecuciones                                                         |
| Ejecuciones por arquitectura  | B0 90, B1 90, B2 82, B3 86                                                     |
| Tareas distintas              | B0 40, B1 40, B2 37, B3 37; **34 tareas en las cuatro**                        |
| Repeticiones por tarea        | B0: 18 tareas con 3, 14 con 2, 8 con 1; B1: 19/12/9; B2: 16/13/8; B3: 17/15/5  |
| Tokens consumidos             | 7,0 M de entrada (1,7 M en cache) + 0,21 M de salida                            |
| Costo a tarifa de lista       | ≈ 2,06 USD (0,25 / 1,50 USD por millon); la matriz completa habria costado ≈ 2,85 USD |

La cobertura es mucho mejor que la del [parcial del 25 de septiembre](resultados-2026-09-25-campana-gemini-parcial.md)
(24–27 tareas por arquitectura, 5 en las cuatro): aqui B0 y B1 tienen las 40
tareas, B2 y B3 37, y los contrastes se calculan sobre 34–40 tareas pareadas.
Sigue sin ser la matriz de 3 repeticiones para cada tarea, asi que las
medianas por tarea de latencia y tokens se apoyan en 1 a 3 ejecuciones segun la
tarea; la efectividad por tarea es la media de las repeticiones disponibles.

## Que dice esta corrida

**Efectividad.** Las cuatro arquitecturas quedan entre 76 % y 81 % (M1.1), con
intervalos que se solapan por completo. `B1 − B0` es exactamente 0 puntos
[−5,8; +6,7] con las 40 tareas: MCP no cambia lo que el agente resuelve.
`B2 − B1` es −6,8 puntos [−20,3; +5,7] (n = 37): el multiagente pierde algo
con este modelo, pero el intervalo incluye el cero; es una diferencia mucho
menor que la de gpt-5.4-mini o gpt-4.1-mini en la
[campaña OpenAI](resultados-2026-09-25-campana-modelos.md), donde el orquestador
pequeño obedecia la sugerencia de ticket del especialista. `B3 − B2` es
+2,9 puntos [−2,9; +9,1] (n = 34): A2A no cambia la efectividad frente al
multiagente en proceso.

**Latencia.** MCP no cuesta latencia (`B1 − B0` = −12 ms [−221; +209]) y su
transporte medido es 12 ms por ejecucion. El multiagente mas que duplica la
latencia (`B2 − B1` = +3 360 ms [+1 068; +4 770]) por las 7–8 llamadas al
modelo frente a 2 (M4.4) y los 4 mensajes entre agentes (M4.5). A2A frente a
en proceso cuesta +447 ms [+86; +632] (`B3 − B2`), con solo 22,5 ms de
transporte: el resto es la serializacion del ciclo de tarea A2A y las llamadas
al modelo de los especialistas, que en B3 corren en procesos distintos.

**Tokens.** `B2 − B1` = +7 816 tokens por ejecucion [+2 642; +10 741]; `B3 − B2`
= −1 [−17; +9]: el transporte no gasta tokens. Con `reasoning_effort: none` el
flash-lite no gasta tokens de razonamiento oculto (`total_tokens = prompt +
completion`, verificado en las 348 trazas), asi que sus tokens son comparables
en lo que cuentan con los de OpenAI.

**Donde falla el flash-lite.** El motivo dominante es `herramienta_prohibida:
proponer_ticket` (9, 10, 14 y 13 ejecuciones en B0–B3): en tareas de solo
diagnostico o solo informacion (T-DIA-001, T-DIA-005, T-DIA-009, T-DIA-010,
T-INF-006, T-INF-007) el modelo propone un ticket que la tarea prohibe. Le
siguen `falta_politica_requerida` (POL-MA-004 en T-COM-007, POL-CI-001 y
POL-AU-001 en T-INF-010, POL-AV-002 en T-COM-009 solo en B2/B3) y
`politica_prohibida` (POL-MA-001 en T-INF-005 en B0/B1; POL-MA-002 en
T-INF-002 en B2/B3). T-COM-002 falla en B0 y B1 por categoria o prioridad del
ticket (`rendimiento` en vez de `acceso`, `P3` en vez de `P2`). Las
adversariales dan 100 % en B0, B1 y B2 y 96 % en B3 (una ejecucion de
T-ADV-007 propuso ticket). Las compuestas dan 80 % en las cuatro.

**Frente a los otros modelos.** Con los mismos prompts, gpt-5.5 y gpt-5.4 dan
91–94 % en las cuatro arquitecturas, Qwen2.5 7B local da 53–56 % en B0/B1 y
33–34 % en B2/B3. El flash-lite queda en medio (76–81 %) y, a diferencia de
los GPT pequeños y del 7B, el multiagente casi no lo degrada. Las latencias
absolutas no se comparan entre campañas que corrieron en momentos distintos
(RM-17); efectividad, llamadas y tokens si.

## Cifras del cuaderno

### Efectividad (M1.1 y M1.3, %, IC 95 %, n = tareas con datos)

| Metrica              | B0                     | B1                     | B2                     | B3                     |
| -------------------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- |
| M1.1 compuerta       | 81,2 [69,2; 92,1] n=40 | 81,2 [68,8; 92,5] n=40 | 75,7 [61,8; 88,5] n=37 | 77,5 [64,4; 89,5] n=37 |
| M1.3 exito estricto  | 77,5 [65,0; 90,0] n=40 | 80,0 [67,5; 92,5] n=40 | 73,0 [58,3; 86,5] n=37 | 73,0 [58,8; 86,5] n=37 |

M1.2 por categoria (%, n = 10 tareas salvo donde se indica): informativa
73 / 70 / 60 / 70; diagnostico 72 / 75 / 67 (n=9) / 67 (n=9); compuesta
80 / 80 / 80 / 80; adversarial 100 / 100 / 100 (n=8) / 96 (n=8).

Contrastes de M1.1 (puntos porcentuales, n = tareas pareadas):

| B1 − B0              | B2 − B1                | B3 − B2               | B3 − B1                |
| -------------------- | ---------------------- | --------------------- | ---------------------- |
| 0,0 [−5,8; +6,7] n=40 | −6,8 [−20,3; +5,7] n=37 | +2,9 [−2,9; +9,1] n=34 | −2,3 [−14,8; +11,0] n=37 |

### Latencia (M4.1, mediana por tarea, ms) y transporte (M4.2, ms)

| Metrica          | B0                    | B1                    | B2                    | B3                    |
| ---------------- | --------------------- | --------------------- | --------------------- | --------------------- |
| M4.1 total       | 2 758 [2 313; 3 234]  | 2 922 [2 462; 3 336]  | 6 732 [3 739; 7 892]  | 7 701 [4 246; 9 234]  |
| M4.2 transporte  | 0,0                   | 12,0 [4,1; 15,7]      | 18,6 [2,7; 28,3]      | 22,5 [11,2; 27,8]     |

Contrastes de M4.1 (ms): `B1 − B0` = −12 [−221; +209] n=40; `B2 − B1` =
+3 360 [+1 068; +4 770] n=37; `B3 − B2` = +447 [+86; +632] n=34; `B3 − B1` =
+4 255 [+1 699; +5 188] n=37. Contrastes de M4.2: `B1 − B0` = +12,0 [+4,1;
+15,7]; `B3 − B2` = 0,0 [−0,1; +2,6].

### Llamadas, mensajes y tokens (M4.4, M4.5, M4.6; medianas por tarea)

| Metrica                 | B0                      | B1                      | B2                      | B3                      |
| ----------------------- | ----------------------- | ----------------------- | ----------------------- | ----------------------- |
| M4.4 llamadas al modelo | 2 [2; 3]                | 2 [2; 3]                | 7 [4; 9]                | 8 [5; 9]                |
| M4.5 mensajes A2A       | 0                       | 0                       | 4 [2; 6]                | 4 [2; 6]                |
| M4.6 tokens totales     | 13 002 [11 397; 17 584] | 11 801 [11 312; 17 294] | 22 630 [16 371; 29 193] | 22 631 [18 010; 29 418] |

Contrastes de M4.6 (tokens): `B1 − B0` = +1 [−8; +8]; `B2 − B1` = +7 816
[+2 642; +10 741]; `B3 − B2` = −1 [−17; +9]; `B3 − B1` = +8 214 [+4 544;
+10 742].

## Como completarla

El saldo de la recarga rindio unos 2 USD efectivos, no los 5 USD nominales
(probablemente absorbio el saldo negativo que dejo la campaña del 25 de
septiembre). Para tener la matriz completa hay que recargar con margen y
relanzar toda la campaña, no solo lo que falta: el ejecutor no reanuda una
matriz, y mezclar esta corrida parcial con una nueva seria una decision de
medicion que debe registrarse antes (RM-17).

```bash
cd experiment
uv run python campana.py --proveedor gemini --modelos gemini-3.1-flash-lite --repeticiones 3
```

Cuesta ≈ 2,85 USD a tarifa de lista y tarda ≈ 45 minutos.

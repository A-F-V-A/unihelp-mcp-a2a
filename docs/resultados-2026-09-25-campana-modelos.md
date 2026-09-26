# Resultados: campaña de cuatro modelos, cuatro arquitecturas, tres repeticiones (25 de septiembre de 2026)

Cuatro campañas, una por modelo, cada una con las cuatro arquitecturas en la
misma matriz (40 tareas x 4 arquitecturas x 3 repeticiones = 480 ejecuciones)
y en su propio entorno aislado (base de datos, `mcp-server` y siete backends
propios), corridas **a la vez** con `experiment/campana.py`. El modelo oficial
del experimento sigue siendo `gpt-5.5-2026-04-23`; los otros tres son el
chequeo de robustez frente al modelo que preve `docs/06` (semana 8).

| Campaña                              | Modelo                  | Ejecuciones | Trazas validas | Cuarentena | Duracion | Tokens de la campaña |
| ------------------------------------ | ----------------------- | ----------- | -------------- | ---------- | -------- | -------------------- |
| `campana-gpt-5-5-2026-04-23-r3`      | gpt-5.5-2026-04-23      | 480         | 480            | 0          | 90 min   | 11,0 M               |
| `campana-gpt-5-4-2026-03-05-r3`      | gpt-5.4-2026-03-05      | 480         | 480            | 0          | 76 min   | 10,8 M               |
| `campana-gpt-5-4-mini-2026-03-17-r3` | gpt-5.4-mini-2026-03-17 | 480         | 480            | 0          | 54 min   | 10,2 M               |
| `campana-gpt-4-1-mini-2025-04-14-r3` | gpt-4.1-mini-2025-04-14 | 480         | 480            | 0          | 56 min   | 8,8 M                |

Comun a las cuatro: codigo `dd09151`, prompt base 1.4.0 y prompts de B2/B3
1.0.0, temperatura 0,2, `reasoning_effort: none` en los GPT-5 (gpt-4.1-mini no
lo admite y no se le envia), modo `record`, semilla 20260922, tarifa sin fijar
(M4.7 = 0). Sin rechazos ni avisos de residuo en ninguna; M7.1 y M7.2 en 1,0.
Todo lo que sigue sale del `resultados.json` de cada campaña (RM-02);
intervalos bootstrap pareado por tarea al 95 % (n = 40 tareas), presentados
como estimacion e intervalo (RM-14). Artefactos en
`experiment/resultados/2026-09-25-campana-<modelo>-r3/` (no se versionan).

## 1. Efectividad

**M1.1 · exito medio** sobre las 120 ejecuciones por arquitectura (%, IC 95 %):

| Modelo       | B0                | B1                | B2                | B3                |
| ------------ | ----------------- | ----------------- | ----------------- | ----------------- |
| gpt-5.5      | 91,7 [82,5; 99,2] | 91,7 [82,5; 99,2] | 94,2 [86,7; 100]  | 92,5 [82,5; 100]  |
| gpt-5.4      | 90,8 [82,5; 98,3] | 90,0 [80,8; 97,5] | 91,7 [83,3; 98,3] | 90,0 [80,8; 97,5] |
| gpt-5.4-mini | 84,2 [75,0; 92,5] | 80,0 [69,2; 90,0] | 70,0 [57,5; 81,7] | 66,7 [55,0; 78,3] |
| gpt-4.1-mini | 80,8 [70,0; 90,8] | 78,3 [67,5; 88,3] | 77,5 [65,8; 88,3] | 75,8 [64,2; 86,7] |

**M1.3 · exito consistente** (la tarea pasa en sus 3 repeticiones) y
**M1.4 · resultado mixto** (pasa unas veces y otras no), en % de las 40 tareas:

| Modelo       | Consistente B0 / B1 / B2 / B3 | Mixto B0 / B1 / B2 / B3   |
| ------------ | ----------------------------- | ------------------------- |
| gpt-5.5      | 90,0 / 90,0 / 92,5 / 92,5     | 2,5 / 2,5 / 2,5 / 0,0     |
| gpt-5.4      | 87,5 / 87,5 / 87,5 / 87,5     | 7,5 / 5,0 / 7,5 / 7,5     |
| gpt-5.4-mini | 70,0 / 70,0 / 57,5 / 52,5     | 25,0 / 20,0 / 25,0 / 32,5 |
| gpt-4.1-mini | 70,0 / 62,5 / 67,5 / 65,0     | 17,5 / 25,0 / 20,0 / 20,0 |

**Contrastes de M1.1** (puntos porcentuales, mediana de la diferencia por tarea):

| Modelo       | B1 − B0 (MCP)      | B2 − B1 (multiagente) | B3 − B2 (A2A)      | B3 − B1             |
| ------------ | ------------------ | --------------------- | ------------------ | ------------------- |
| gpt-5.5      | 0,0 [−2,5; +2,5]   | +2,5 [−1,7; +8,3]     | −1,7 [−5,0; 0,0]   | +0,8 [−6,7; +8,3]   |
| gpt-5.4      | −0,8 [−2,5; 0,0]   | +1,7 [0,0; +5,0]      | −1,7 [−8,3; +4,2]  | 0,0 [−6,7; +5,8]    |
| gpt-5.4-mini | −4,2 [−13,3; +4,2] | −10,0 [−25,8; +5,8]   | −3,3 [−10,0; +3,3] | −13,3 [−27,5; +0,8] |
| gpt-4.1-mini | −2,5 [−9,2; +4,2]  | −0,8 [−11,7; +10,0]   | −1,7 [−10,8; +6,7] | −2,5 [−13,3; +8,3]  |

Lectura:

- **Con gpt-5.5 y gpt-5.4 las cuatro arquitecturas son indistinguibles en
  efectividad**: todos los contrastes incluyen el cero y el resultado mixto es
  del 0 al 7,5 %. Con tres repeticiones, la diferencia B0 frente a B1 de la
  corrida de una repeticion (35 frente a 37) desaparece: 91,7 % en ambas.
- **Con los modelos pequeños el multiagente pierde**: gpt-5.4-mini cae de
  84 % (B0) a 67 % (B3) y el resultado mixto sube al 20–33 %. El intervalo de
  B3 − B1 (−13,3 [−27,5; +0,8]) roza el cero. La causa esta en la seccion 2.
- MCP (B1 − B0) no cambia la efectividad con ningun modelo.

**M1.2 · por categoria** (% medio):

| Modelo       | Categoria                                           | B0                  | B1                  | B2                    | B3                    |
| ------------ | --------------------------------------------------- | ------------------- | ------------------- | --------------------- | --------------------- |
| gpt-5.5      | informativa / diagnostico / compuesta / adversarial | 77 / 100 / 90 / 100 | 80 / 100 / 87 / 100 | 87 / 100 / 90 / 100   | 80 / 100 / 90 / 100   |
| gpt-5.4      | idem                                                | 77 / 100 / 87 / 100 | 73 / 100 / 87 / 100 | 80 / 100 / 87 / 100   | 80 / 100 / 80 / 100   |
| gpt-5.4-mini | idem                                                | 87 / 100 / 57 / 93  | 87 / 100 / 53 / 80  | 73 / **43** / 80 / 83 | 77 / **50** / 63 / 77 |
| gpt-4.1-mini | idem                                                | 83 / 97 / 50 / 93   | 80 / 90 / 57 / 87   | 80 / **73** / 60 / 97 | 87 / **57** / 63 / 97 |

## 2. Por que caen los modelos pequeños en B2 y B3

Los motivos de la compuerta lo dicen sin ambiguedad. En las tareas de
**diagnostico** (la persona pregunta que pasa; la tarea prohibe proponer un
ticket) B2 y B3 fallan casi siempre por `herramienta_prohibida:
proponer_ticket`: 17 y 14 de 30 ejecuciones con gpt-5.4-mini, 8 y 13 con
gpt-4.1-mini, frente a 0 a 3 en B0 y B1. El especialista de diagnostico
devuelve `accion_recomendada: crear_ticket` (es lo que la regla de docs/03
dice para un servicio degradado) y **el orquestador pequeño obedece la
sugerencia en vez de aplicar la regla del prompt** ("corresponde registrar
cuando la persona PIDE reportar"); el orquestador grande no. Con los modelos
grandes ese motivo no aparece.

En las tareas **compuestas** pasa lo contrario: B0 y B1 con modelos pequeños
fallan sobre todo por `falta_herramienta_obligatoria` (15 a 20 de 30: el
agente unico no llega a proponer el ticket que la tarea exige), mientras que
B2 y B3 proponen mas y aciertan mas (80 % y 63 % frente a 57 % y 53 % con
gpt-5.4-mini). Es decir: **dividir el trabajo en especialistas hace al sistema
mas propenso a actuar**, para bien en las compuestas y para mal en las de
solo diagnostico, y ese sesgo solo lo corrige un modelo capaz de aplicar la
regla de dos preguntas del prompt base. No es un defecto del transporte ni
del codigo: B2 y B3 se comportan igual entre si.

Tareas que fallan en las 12 ejecuciones (4 arquitecturas x 3 repeticiones):
T-COM-009 y T-INF-010 con gpt-5.5 (las dos con decision pendiente del equipo,
P1 y P2); T-COM-009 con gpt-5.4; ninguna con gpt-5.4-mini; T-COM-005 y
T-COM-009 con gpt-4.1-mini. T-INF-005 sigue siendo frecuente en B0/B1.

## 3. Latencia (M4.1, mediana por tarea, ms)

| Modelo       | B0                   | B1                   | B2                     | B3                     |
| ------------ | -------------------- | -------------------- | ---------------------- | ---------------------- |
| gpt-5.5      | 5 517 [4 951; 6 644] | 5 818 [4 801; 6 321] | 12 188 [8 746; 14 169] | 12 201 [8 726; 13 312] |
| gpt-5.4      | 4 540 [3 627; 5 284] | 4 806 [3 769; 5 335] | 9 784 [8 266; 11 135]  | 10 199 [7 189; 12 004] |
| gpt-5.4-mini | 2 766 [2 371; 3 384] | 2 897 [2 309; 3 427] | 6 601 [4 782; 8 815]   | 7 415 [4 513; 8 990]   |
| gpt-4.1-mini | 2 817 [2 526; 3 738] | 2 735 [2 443; 3 779] | 5 190 [4 464; 8 114]   | 5 225 [4 756; 8 196]   |

Contrastes de la latencia total (ms):

| Modelo       | B1 − B0          | B2 − B1                     | B3 − B2               | B3 − B1                 |
| ------------ | ---------------- | --------------------------- | --------------------- | ----------------------- |
| gpt-5.5      | −26 [−197; +54]  | **+6 180** [+3 548; +7 478] | **+251** [+118; +444] | +5 770 [+4 298; +7 118] |
| gpt-5.4      | −34 [−149; +147] | **+4 656** [+3 719; +5 210] | +25 [−70; +295]       | +5 044 [+3 355; +5 425] |
| gpt-5.4-mini | −32 [−276; +175] | **+3 083** [+2 241; +4 848] | +16 [−309; +208]      | +4 156 [+2 055; +4 965] |
| gpt-4.1-mini | +20 [−46; +94]   | **+2 159** [+1 408; +4 044] | +99 [−25; +374]       | +2 775 [+2 190; +4 316] |

Componente de transporte de M4.2 (ms, mediana por tarea) y su contraste:

| Modelo       | B0  | B1   | B2   | B3   | B1 − B0             | B3 − B2           |
| ------------ | --- | ---- | ---- | ---- | ------------------- | ----------------- |
| gpt-5.5      | 0,0 | 10,6 | 6,1  | 12,2 | +10,6 [+3,0; +14,3] | +4,6 [+1,2; +6,1] |
| gpt-5.4      | 0,0 | 9,1  | 10,5 | 13,3 | +9,1 [+3,3; +15,1]  | +2,3 [0,0; +4,7]  |
| gpt-5.4-mini | 0,0 | 11,2 | 11,2 | 12,0 | +11,2 [+5,5; +15,4] | −0,5 [−3,7; +2,0] |
| gpt-4.1-mini | 0,0 | 5,4  | 3,2  | 8,7  | +5,4 [+2,5; +13,2]  | +1,1 [0,0; +3,1]  |

Lectura, estable en los cuatro modelos:

- **MCP no cuesta latencia de extremo a extremo** (B1 − B0 incluye el cero en
  los cuatro) y su transporte medible es de 5 a 11 ms por ejecucion.
- **El multiagente duplica la latencia** y el sobrecosto crece con el modelo
  (+2,2 s con gpt-4.1-mini, +6,2 s con gpt-5.5) porque casi todo es tiempo de
  modelo: 7 llamadas por ejecucion frente a 3 (M4.4), 4 mensajes entre
  agentes (M4.5) en B2 y en B3 por igual.
- **A2A frente a en proceso** cuesta del orden de 0 a 250 ms por ejecucion
  (solo con gpt-5.5 el intervalo de B3 − B2 excluye el cero) y de 0 a 5 ms en
  el componente de transporte. Es el piso del salto de red entre agentes.

## 4. Tokens (M4.6, total por ejecucion, mediana por tarea)

| Modelo       | B0     | B1     | B2     | B3     | B2 − B1                 | B3 − B2       |
| ------------ | ------ | ------ | ------ | ------ | ----------------------- | ------------- |
| gpt-5.5      | 16 596 | 16 442 | 24 671 | 24 600 | +7 940 [+5 266; +8 752] | −2 [−17; 0]   |
| gpt-5.4      | 16 403 | 16 122 | 24 820 | 24 620 | +8 169 [+5 288; +8 560] | −6 [−18; +2]  |
| gpt-5.4-mini | 15 526 | 15 796 | 23 269 | 24 634 | +7 812 [+5 176; +9 210] | −4 [−50; +12] |
| gpt-4.1-mini | 10 488 | 10 480 | 15 315 | 17 224 | +4 834 [+3 203; +7 856] | −2 [−12; +12] |

El multiagente cuesta unos 8 000 tokens mas por ejecucion (un 50 % mas); A2A
frente a en proceso no cuesta tokens (los mensajes entre agentes no pasan por
el modelo). Con gpt-4.1-mini el orquestador hace menos llamadas (4 a 5 frente
a 7) y por eso gasta menos.

## 5. Lo que esta campaña no incluye ni permite

- Las cuatro campañas corrieron **a la vez en la misma maquina**. Dentro de
  cada campaña la carga local es comun a las cuatro arquitecturas, asi que los
  contrastes por modelo son validos; comparar latencias absolutas ENTRE
  modelos corridos en paralelo es una decision de medicion aparte (RM-17).
- Tarifa sin fijar (M4.7 = 0), sin microbenchmark de transporte (M4.3
  `sin_datos`), sin juez ni validacion humana (M7.4, M7.5).
- Los prompts no se tocaron. El hallazgo de la seccion 2 (el orquestador
  pequeño obedece la sugerencia del especialista) es material para una
  decision sobre el prompt del orquestador, no para esta campaña.

## 6. Como reproducir

Ver "Campañas de varios modelos" en `experiment/README.md`
(`uv run python campana.py --modelos ... --repeticiones 3`). Cada campaña
deja `corridas/campana-<modelo>-r3`, `salidas/campana-<modelo>-r3` y la copia
en `resultados/`.

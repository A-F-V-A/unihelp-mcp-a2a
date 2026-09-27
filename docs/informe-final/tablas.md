# Tablas de cifras del informe final

Generado por `docs/informe-final/tablas.py`; no editar a mano. Cada tabla dice de qué archivo sale.
Los intervalos son bootstrap percentil pareado por tarea al 95 % con n = 40 tareas; un `*` marca
los que excluyen el cero. Las medianas son medianas entre tareas de la mediana de cada tarea.

### T1. Campañas que entran al análisis

Fuente: `experiment/resultados/<corrida>/resultados.json`, bloque `corrida`

| Modelo | Carpeta | Identificador | Ejecuciones válidas | Intentadas | Commit | Semilla |
| --- | --- | --- | --- | --- | --- | --- |
| gpt-5.5 | `2026-09-25-campana-gpt-5-5-2026-04-23-r3` | gpt-5.5-2026-04-23 | 480 | 480 | `60e6d996cd60+sucio` | 20260922 |
| gpt-5.4 | `2026-09-25-campana-gpt-5-4-2026-03-05-r3` | gpt-5.4-2026-03-05 | 480 | 480 | `60e6d996cd60+sucio` | 20260922 |
| gpt-5.4-mini | `2026-09-25-campana-gpt-5-4-mini-2026-03-17-r3` | gpt-5.4-mini-2026-03-17 | 480 | 480 | `60e6d996cd60+sucio` | 20260922 |
| gpt-4.1-mini | `2026-09-25-campana-gpt-4-1-mini-2025-04-14-r3` | gpt-4.1-mini-2025-04-14 | 480 | 480 | `60e6d996cd60+sucio` | 20260922 |
| Qwen2.5 7B (local) | `2026-09-25-campana-unihelp-qwen2-5-7b-instruct-q4_K_M-ctx16k-r3` | unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k | 480 | 480 | `96fb3d15a61d+sucio` | 20260922 |
| gemini-3.1-flash-lite (parcial) | `2026-09-26-campana-gemini-3-1-flash-lite-r3` | gemini-3.1-flash-lite | 348 | 348 | `d311bc077d36+sucio` | 20260922 |

### T2. Consumo · gpt-5.5

Fuente: `experiment/resultados/<corrida>/resultados.json` de `2026-09-25-campana-gpt-5-5-2026-04-23-r3` (M4.1, M4.4, M4.5, M4.6, M4.7)

| Arq. | Tokens entrada (mediana) | Tokens salida (mediana) | Tokens total (mediana) | Tokens total (corrida) | Llamadas al modelo | Mensajes entre agentes | Latencia p50 (ms) | Latencia p95 (ms) | USD por ejecución (mediana) | USD corrida | USD por 1000 solicitudes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 16 252 | 316 | 16 596 | 2 304 612 | 3,0 | 0,0 | 5 517 | 14 232 | 0,0293 | 4,13 | 29,26 |
| B1 | 16 160 | 320 | 16 442 | 2 261 203 | 3,0 | 0,0 | 5 818 | 13 594 | 0,0285 | 4,09 | 28,47 |
| B2 | 23 928 | 642 | 24 671 | 3 232 416 | 7,0 | 4,0 | 12 188 | 24 540 | 0,0572 | 6,86 | 57,21 |
| B3 | 23 898 | 669 | 24 600 | 3 196 909 | 7,0 | 4,0 | 12 201 | 24 281 | 0,0574 | 6,84 | 57,37 |

### T2. Consumo · gpt-5.4

Fuente: `experiment/resultados/<corrida>/resultados.json` de `2026-09-25-campana-gpt-5-4-2026-03-05-r3` (M4.1, M4.4, M4.5, M4.6, M4.7)

| Arq. | Tokens entrada (mediana) | Tokens salida (mediana) | Tokens total (mediana) | Tokens total (corrida) | Llamadas al modelo | Mensajes entre agentes | Latencia p50 (ms) | Latencia p95 (ms) | USD por ejecución (mediana) | USD corrida | USD por 1000 solicitudes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 16 100 | 278 | 16 403 | 2 219 977 | 3,0 | 0,0 | 4 540 | 11 861 | 0,0169 | 2,31 | 16,94 |
| B1 | 15 822 | 306 | 16 122 | 2 199 004 | 3,0 | 0,0 | 4 806 | 11 658 | 0,0169 | 2,23 | 16,93 |
| B2 | 24 075 | 644 | 24 820 | 3 184 011 | 7,0 | 4,0 | 9 784 | 17 425 | 0,0284 | 3,45 | 28,37 |
| B3 | 23 944 | 658 | 24 620 | 3 239 834 | 7,0 | 4,0 | 10 199 | 19 173 | 0,0285 | 3,49 | 28,54 |

### T2. Consumo · gpt-5.4-mini

Fuente: `experiment/resultados/<corrida>/resultados.json` de `2026-09-25-campana-gpt-5-4-mini-2026-03-17-r3` (M4.1, M4.4, M4.5, M4.6, M4.7)

| Arq. | Tokens entrada (mediana) | Tokens salida (mediana) | Tokens total (mediana) | Tokens total (corrida) | Llamadas al modelo | Mensajes entre agentes | Latencia p50 (ms) | Latencia p95 (ms) | USD por ejecución (mediana) | USD corrida | USD por 1000 solicitudes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 15 312 | 236 | 15 526 | 1 986 121 | 3,0 | 0,0 | 2 766 | 7 126 | 0,0029 | 0,4426 | 2,93 |
| B1 | 15 531 | 232 | 15 796 | 2 021 922 | 3,0 | 0,0 | 2 897 | 6 962 | 0,0033 | 0,4511 | 3,31 |
| B2 | 22 662 | 618 | 23 269 | 3 106 708 | 7,0 | 4,0 | 6 601 | 12 853 | 0,0075 | 0,9273 | 7,55 |
| B3 | 23 914 | 678 | 24 634 | 3 082 635 | 7,0 | 4,0 | 7 415 | 13 227 | 0,0079 | 0,9246 | 7,88 |

### T2. Consumo · gpt-4.1-mini

Fuente: `experiment/resultados/<corrida>/resultados.json` de `2026-09-25-campana-gpt-4-1-mini-2025-04-14-r3` (M4.1, M4.4, M4.5, M4.6, M4.7)

| Arq. | Tokens entrada (mediana) | Tokens salida (mediana) | Tokens total (mediana) | Tokens total (corrida) | Llamadas al modelo | Mensajes entre agentes | Latencia p50 (ms) | Latencia p95 (ms) | USD por ejecución (mediana) | USD corrida | USD por 1000 solicitudes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 10 288 | 212 | 10 488 | 1 872 339 | 2,0 | 0,0 | 2 817 | 9 160 | 0,0020 | 0,3118 | 1,96 |
| B1 | 10 281 | 219 | 10 480 | 1 847 620 | 2,0 | 0,0 | 2 735 | 8 679 | 0,0018 | 0,3049 | 1,83 |
| B2 | 15 008 | 374 | 15 315 | 2 576 199 | 4,0 | 2,0 | 5 190 | 14 396 | 0,0029 | 0,4777 | 2,91 |
| B3 | 16 930 | 408 | 17 224 | 2 523 398 | 5,0 | 2,0 | 5 225 | 14 685 | 0,0032 | 0,4776 | 3,21 |

### T2. Consumo · Qwen2.5 7B (local)

Fuente: `experiment/resultados/<corrida>/resultados.json` de `2026-09-25-campana-unihelp-qwen2-5-7b-instruct-q4_K_M-ctx16k-r3` (M4.1, M4.4, M4.5, M4.6, M4.7)

| Arq. | Tokens entrada (mediana) | Tokens salida (mediana) | Tokens total (mediana) | Tokens total (corrida) | Llamadas al modelo | Mensajes entre agentes | Latencia p50 (ms) | Latencia p95 (ms) | USD por ejecución (mediana) | USD corrida | USD por 1000 solicitudes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 12 029 | 325 | 12 334 | 1 483 283 | 2,0 | 0,0 | 5 518 | 9 535 | 0,0000 | 0,0000 | 0,0000 |
| B1 | 11 960 | 312 | 12 244 | 1 521 476 | 2,0 | 0,0 | 5 349 | 10 888 | 0,0000 | 0,0000 | 0,0000 |
| B2 | 15 282 | 530 | 15 788 | 3 703 064 | 4,0 | 2,0 | 8 419 | 25 006 | 0,0000 | 0,0000 | 0,0000 |
| B3 | 15 330 | 566 | 15 912 | 3 265 897 | 4,0 | 2,0 | 8 781 | 26 359 | 0,0000 | 0,0000 | 0,0000 |

### T2. Consumo · gemini-3.1-flash-lite (parcial)

Fuente: `experiment/resultados/<corrida>/resultados.json` de `2026-09-26-campana-gemini-3-1-flash-lite-r3` (M4.1, M4.4, M4.5, M4.6, M4.7)

| Arq. | Tokens entrada (mediana) | Tokens salida (mediana) | Tokens total (mediana) | Tokens total (corrida) | Llamadas al modelo | Mensajes entre agentes | Latencia p50 (ms) | Latencia p95 (ms) | USD por ejecución (mediana) | USD corrida | USD por 1000 solicitudes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 12 723 | 302 | 13 002 | 1 522 293 | 2,2 | 0,0 | 2 758 | 7 557 | 0,0033 | 0,3240 | 3,28 |
| B1 | 11 498 | 298 | 11 801 | 1 389 482 | 2,0 | 0,0 | 2 922 | 6 480 | 0,0032 | 0,2993 | 3,16 |
| B2 | 21 726 | 719 | 22 630 | 2 142 742 | 7,0 | 4,0 | 6 732 | 12 596 | 0,0060 | 0,5170 | 6,05 |
| B3 | 21 721 | 868 | 22 631 | 2 160 540 | 8,0 | 4,0 | 7 701 | 12 070 | 0,0061 | 0,5365 | 6,08 |

### T3. Descomposición de la latencia (M4.2, medianas en ms)

Fuente: `experiment/resultados/<corrida>/resultados.json`

| Modelo | Arq. | Modelo (ms) | Herramientas (ms) | Transporte (ms) | Orquestación (ms) | Orquestación / total |
| --- | --- | --- | --- | --- | --- | --- |
| gpt-5.5 | B0 | 5 500,6 | 14,4 | 0,0 | 2,9 | 0,05 % |
| gpt-5.5 | B1 | 5 767,2 | 19,0 | 10,6 | 3,3 | 0,06 % |
| gpt-5.5 | B2 | 12 141,5 | 25,2 | 6,1 | 6,2 | 0,06 % |
| gpt-5.5 | B3 | 12 135,3 | 22,8 | 12,2 | 6,0 | 0,06 % |
| gpt-5.4 | B0 | 4 522,8 | 14,1 | 0,0 | 2,9 | 0,06 % |
| gpt-5.4 | B1 | 4 771,8 | 17,9 | 9,1 | 2,8 | 0,07 % |
| gpt-5.4 | B2 | 9 761,6 | 21,9 | 10,5 | 6,0 | 0,07 % |
| gpt-5.4 | B3 | 10 165,3 | 20,2 | 13,3 | 6,4 | 0,07 % |
| gpt-5.4-mini | B0 | 2 751,8 | 12,8 | 0,0 | 2,6 | 0,10 % |
| gpt-5.4-mini | B1 | 2 861,3 | 12,3 | 11,2 | 2,6 | 0,10 % |
| gpt-5.4-mini | B2 | 6 551,0 | 20,4 | 11,2 | 5,3 | 0,09 % |
| gpt-5.4-mini | B3 | 7 370,4 | 17,4 | 12,0 | 5,9 | 0,09 % |
| gpt-4.1-mini | B0 | 2 808,5 | 9,6 | 0,0 | 2,5 | 0,09 % |
| gpt-4.1-mini | B1 | 2 718,6 | 9,1 | 5,4 | 2,5 | 0,09 % |
| gpt-4.1-mini | B2 | 5 161,2 | 15,4 | 3,2 | 4,5 | 0,09 % |
| gpt-4.1-mini | B3 | 5 205,6 | 14,7 | 8,7 | 4,2 | 0,08 % |
| Qwen2.5 7B (local) | B0 | 5 508,0 | 9,0 | 0,0 | 1,7 | 0,03 % |
| Qwen2.5 7B (local) | B1 | 5 318,2 | 19,4 | 3,7 | 1,7 | 0,03 % |
| Qwen2.5 7B (local) | B2 | 8 400,3 | 7,3 | 2,1 | 2,4 | 0,03 % |
| Qwen2.5 7B (local) | B3 | 8 762,1 | 11,6 | 4,5 | 2,6 | 0,03 % |
| gemini-3.1-flash-lite (parcial) | B0 | 2 736,0 | 13,7 | 0,0 | 2,5 | 0,09 % |
| gemini-3.1-flash-lite (parcial) | B1 | 2 892,2 | 15,0 | 12,0 | 2,3 | 0,09 % |
| gemini-3.1-flash-lite (parcial) | B2 | 6 677,8 | 21,9 | 18,6 | 6,1 | 0,09 % |
| gemini-3.1-flash-lite (parcial) | B3 | 7 655,4 | 19,3 | 22,5 | 6,1 | 0,08 % |

### T4. Piso de latencia por transporte (M4.3, ms por llamada)

Fuente: `experiment/bench-transport.json` calculado por el cuaderno (igual en todas las corridas)

| Transporte | p50 | p95 | p99 | Desviación estándar |
| --- | --- | --- | --- | --- |
| `adaptador_local` | 0,001 | 0,003 | 0,014 | 0,003 |
| `mcp_streamable_http` | 13,117 | 16,689 | 21,609 | 5,694 |
| `a2a_salto` | 15,216 | 16,747 | 23,110 | 5,176 |
| `ruta_completa_http` | 0,936 | 1,165 | 1,350 | 0,212 |

### T5. Contrastes pareados · Tokens totales por ejecución (M4.6)

Fuente: `experiment/resultados/<corrida>/resultados.json`, campo `contrastes`

| Modelo | B1 − B0 | B2 − B1 | B3 − B2 | B3 − B1 |
| --- | --- | --- | --- | --- |
| gpt-5.5 | -3 [-11; 6] | 7 940 [5 266; 8 752] * | -2 [-17; 0] | 7 900 [5 027; 8 558] * |
| gpt-5.4 | -3 [-11; 4] | 8 169 [5 288; 8 560] * | -6 [-18; 2] | 8 037 [5 117; 8 470] * |
| gpt-5.4-mini | 2 [-10; 10] | 7 812 [5 176; 9 210] * | -4 [-50; 12] | 8 126 [4 896; 12 358] * |
| gpt-4.1-mini | 0 [-8; 6] | 4 834 [3 203; 7 856] * | -2 [-12; 12] | 5 784 [3 681; 7 768] * |
| Qwen2.5 7B (local) | 0 [-14; 27] | 3 203 [300; 3 725] * | 7 [-13; 80] | 3 175 [300; 3 675] * |
| gemini-3.1-flash-lite (parcial) | 1 [-8; 8] | 7 816 [2 642; 10 741] * | -1 [-17; 9] | 8 214 [4 544; 10 742] * |

### T5. Contrastes pareados · Latencia de extremo a extremo (ms) (M4.1)

Fuente: `experiment/resultados/<corrida>/resultados.json`, campo `contrastes`

| Modelo | B1 − B0 | B2 − B1 | B3 − B2 | B3 − B1 |
| --- | --- | --- | --- | --- |
| gpt-5.5 | -26 [-197; 54] | 6 180 [3 548; 7 478] * | 251 [118; 444] * | 5 770 [4 298; 7 118] * |
| gpt-5.4 | -34 [-149; 147] | 4 656 [3 719; 5 210] * | 25 [-70; 295] | 5 044 [3 355; 5 425] * |
| gpt-5.4-mini | -32 [-276; 175] | 3 083 [2 241; 4 848] * | 16 [-309; 208] | 4 156 [2 055; 4 965] * |
| gpt-4.1-mini | 20 [-46; 94] | 2 159 [1 408; 4 044] * | 99 [-25; 374] | 2 775 [2 190; 4 316] * |
| Qwen2.5 7B (local) | 87 [-176; 323] | 1 642 [286; 3 723] * | 108 [-235; 812] | 2 188 [1 134; 3 624] * |
| gemini-3.1-flash-lite (parcial) | -12 [-221; 209] | 3 360 [1 068; 4 770] * | 447 [86; 632] * | 4 255 [1 699; 5 188] * |

### T5. Contrastes pareados · Costo por ejecución (USD) (M4.7)

Fuente: `experiment/resultados/<corrida>/resultados.json`, campo `contrastes`

| Modelo | B1 − B0 | B2 − B1 | B3 − B2 | B3 − B1 |
| --- | --- | --- | --- | --- |
| gpt-5.5 | -0,0001 [-0,0003; 0,0001] | 0,0257 [0,0109; 0,0324] * | -0,0000 [-0,0002; 0,0001] | 0,0257 [0,0079; 0,0307] * |
| gpt-5.4 | -0,0001 [-0,0014; 0,0003] | 0,0105 [0,0055; 0,0127] * | -0,0001 [-0,0002; 0,0000] | 0,0112 [0,0050; 0,0127] * |
| gpt-5.4-mini | -0,0000 [-0,0001; 0,0000] | 0,0041 [0,0028; 0,0051] * | -0,0000 [-0,0001; 0,0001] | 0,0041 [0,0023; 0,0055] * |
| gpt-4.1-mini | -0,0000 [-0,0001; -0,0000] * | 0,0011 [0,0006; 0,0017] * | 0,0000 [-0,0000; 0,0002] | 0,0013 [0,0010; 0,0019] * |
| Qwen2.5 7B (local) | 0,0000 [0,0000; 0,0000] | 0,0000 [0,0000; 0,0000] | 0,0000 [0,0000; 0,0000] | 0,0000 [0,0000; 0,0000] |
| gemini-3.1-flash-lite (parcial) | -0,0000 [-0,0000; 0,0000] | 0,0027 [0,0013; 0,0034] * | 0,0000 [-0,0000; 0,0000] | 0,0030 [0,0015; 0,0035] * |

### T5. Contrastes pareados · Mensajes entre agentes (M4.5)

Fuente: `experiment/resultados/<corrida>/resultados.json`, campo `contrastes`

| Modelo | B1 − B0 | B2 − B1 | B3 − B2 | B3 − B1 |
| --- | --- | --- | --- | --- |
| gpt-5.5 | 0,0 [0,0; 0,0] | 4,0 [2,0; 4,0] * | 0,0 [0,0; 0,0] | 4,0 [2,0; 4,0] * |
| gpt-5.4 | 0,0 [0,0; 0,0] | 4,0 [3,0; 4,0] * | 0,0 [0,0; 0,0] | 4,0 [2,0; 4,0] * |
| gpt-5.4-mini | 0,0 [0,0; 0,0] | 4,0 [2,0; 4,0] * | 0,0 [0,0; 0,0] | 4,0 [2,0; 4,0] * |
| gpt-4.1-mini | 0,0 [0,0; 0,0] | 2,0 [2,0; 4,0] * | 0,0 [0,0; 0,0] | 2,0 [2,0; 4,0] * |
| Qwen2.5 7B (local) | 0,0 [0,0; 0,0] | 2,0 [0,0; 2,0] | 0,0 [0,0; 0,0] | 2,0 [0,0; 2,0] |
| gemini-3.1-flash-lite (parcial) | 0,0 [0,0; 0,0] | 4,0 [2,0; 6,0] * | 0,0 [0,0; 0,0] | 4,0 [2,0; 6,0] * |

### T6. Tasa de éxito M1.1: solo compuerta / compuerta + juez

Fuente: solo compuerta: `resultados.json` en el commit 3299c79; con juez: `experiment/resultados/<corrida>/resultados.json`

| Modelo | B0 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- |
| gpt-5.5 | 91,7 % / 40,8 % | 91,7 % / 34,2 % | 94,2 % / 48,3 % | 92,5 % / 50,8 % |
| gpt-5.4 | 90,8 % / 33,3 % | 90,0 % / 34,2 % | 91,7 % / 33,3 % | 90,0 % / 30,0 % |
| gpt-5.4-mini | 84,2 % / 18,3 % | 80,0 % / 18,3 % | 70,0 % / 18,3 % | 66,7 % / 13,3 % |
| gpt-4.1-mini | 80,8 % / 23,3 % | 78,3 % / 24,2 % | 77,5 % / 23,3 % | 75,8 % / 28,3 % |
| Qwen2.5 7B (local) | 55,8 % / 3,3 % | 53,3 % / 8,3 % | 32,5 % / 1,7 % | 34,2 % / 6,7 % |
| gemini-3.1-flash-lite (parcial) | 81,2 % / 30,8 % | 81,2 % / 30,0 % | 75,7 % / 27,0 % | 77,5 % / 26,1 % |

### T7. Contrastes de la tasa de éxito (solo compuerta)

Fuente: `resultados.json` commit 3299c79, M1.1

| Modelo | B1 − B0 | B2 − B1 | B3 − B2 | B3 − B1 |
| --- | --- | --- | --- | --- |
| gpt-5.5 | 0,0 % [-2,5 %; 2,5 %] | 2,5 % [-1,7 %; 8,3 %] | -1,7 % [-5,0 %; 0,0 %] | 0,8 % [-6,7 %; 8,3 %] |
| gpt-5.4 | -0,8 % [-2,5 %; 0,0 %] | 1,7 % [0,0 %; 5,0 %] | -1,7 % [-8,3 %; 4,2 %] | 0,0 % [-6,7 %; 5,8 %] |
| gpt-5.4-mini | -4,2 % [-13,3 %; 4,2 %] | -10,0 % [-25,8 %; 5,8 %] | -3,3 % [-10,0 %; 3,3 %] | -13,3 % [-27,5 %; 0,8 %] |
| gpt-4.1-mini | -2,5 % [-9,2 %; 4,2 %] | -0,8 % [-11,7 %; 10,0 %] | -1,7 % [-10,8 %; 6,7 %] | -2,5 % [-13,3 %; 8,3 %] |
| Qwen2.5 7B (local) | -2,5 % [-10,8 %; 6,7 %] | -20,8 % [-33,3 %; -9,2 %] * | 1,7 % [-5,0 %; 9,2 %] | -19,2 % [-31,7 %; -7,5 %] * |
| gemini-3.1-flash-lite (parcial) | 0,0 % [-5,8 %; 6,7 %] | -6,8 % [-20,3 %; 5,7 %] | 2,9 % [-2,9 %; 9,1 %] | -2,3 % [-14,8 %; 11,0 %] |

### T7. Contrastes de la tasa de éxito (compuerta + juez)

Fuente: `resultados.json` actual, M1.1

| Modelo | B1 − B0 | B2 − B1 | B3 − B2 | B3 − B1 |
| --- | --- | --- | --- | --- |
| gpt-5.5 | -6,7 % [-14,2 %; -0,8 %] * | 14,2 % [5,0 %; 24,2 %] * | 2,5 % [-0,8 %; 5,8 %] | 16,7 % [5,8 %; 28,3 %] * |
| gpt-5.4 | 0,8 % [-5,0 %; 6,7 %] | -0,8 % [-6,7 %; 5,0 %] | -3,3 % [-8,3 %; 1,7 %] | -4,2 % [-11,7 %; 2,5 %] |
| gpt-5.4-mini | 0,0 % [-5,8 %; 5,8 %] | 0,0 % [-8,3 %; 7,5 %] | -5,0 % [-10,0 %; 0,0 %] | -5,0 % [-13,3 %; 2,5 %] |
| gpt-4.1-mini | 0,8 % [-3,3 %; 5,8 %] | -0,8 % [-10,8 %; 9,2 %] | 5,0 % [-2,5 %; 13,3 %] | 4,2 % [-4,2 %; 12,5 %] |
| Qwen2.5 7B (local) | 5,0 % [0,8 %; 10,8 %] * | -6,7 % [-14,2 %; -0,8 %] * | 5,0 % [0,0 %; 11,7 %] | -1,7 % [-8,3 %; 3,3 %] |
| gemini-3.1-flash-lite (parcial) | -0,8 % [-4,6 %; 2,5 %] | -4,1 % [-11,6 %; 1,9 %] | -1,0 % [-7,8 %; 5,2 %] | -5,0 % [-15,4 %; 4,5 %] |

### T8. Uso de herramientas (M2)

Fuente: `experiment/resultados/<corrida>/resultados.json`

| Modelo | Arq. | M2.1 obligatorias cubiertas | M2.2 ejecuciones con herramienta prohibida | M2.3 argumentos válidos | M2.4 orden parcial | M2.5 llamadas superfluas (media) | M2.6 error de herramienta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-5.5 | B0 | 99,6 % | 0 | 98,6 % | 100,0 % | 0,77 | 0,00 % |
| gpt-5.5 | B1 | 100,0 % | 0 | 99,3 % | 100,0 % | 0,70 | 0,00 % |
| gpt-5.5 | B2 | 100,0 % | 0 | 99,5 % | 100,0 % | 0,94 | 0,00 % |
| gpt-5.5 | B3 | 100,0 % | 0 | 99,5 % | 100,0 % | 0,92 | 0,00 % |
| gpt-5.4 | B0 | 99,3 % | 0 | 98,6 % | 100,0 % | 0,69 | 0,40 % |
| gpt-5.4 | B1 | 98,9 % | 0 | 98,7 % | 100,0 % | 0,68 | 0,00 % |
| gpt-5.4 | B2 | 98,9 % | 0 | 99,1 % | 100,0 % | 0,92 | 0,00 % |
| gpt-5.4 | B3 | 98,9 % | 0 | 98,9 % | 100,0 % | 0,97 | 0,00 % |
| gpt-5.4-mini | B0 | 94,7 % | 1 | 98,3 % | 100,0 % | 0,67 | 0,87 % |
| gpt-5.4-mini | B1 | 96,1 % | 5 | 97,8 % | 100,0 % | 0,65 | 1,28 % |
| gpt-5.4-mini | B2 | 99,6 % | 26 | 98,6 % | 100,0 % | 0,97 | 0,00 % |
| gpt-5.4-mini | B3 | 98,0 % | 27 | 97,7 % | 100,0 % | 0,97 | 0,70 % |
| gpt-4.1-mini | B0 | 95,9 % | 5 | 94,9 % | 100,0 % | 0,48 | 2,34 % |
| gpt-4.1-mini | B1 | 96,0 % | 9 | 96,9 % | 100,0 % | 0,44 | 0,96 % |
| gpt-4.1-mini | B2 | 97,3 % | 13 | 97,0 % | 100,0 % | 0,53 | 1,78 % |
| gpt-4.1-mini | B3 | 97,0 % | 16 | 97,1 % | 100,0 % | 0,53 | 1,35 % |
| Qwen2.5 7B (local) | B0 | 72,8 % | 6 | 92,6 % | 100,0 % | 0,59 | 1,72 % |
| Qwen2.5 7B (local) | B1 | 73,8 % | 6 | 91,4 % | 100,0 % | 0,62 | 2,79 % |
| Qwen2.5 7B (local) | B2 | 47,3 % | 4 | 96,6 % | 100,0 % | 1,49 | 7,63 % |
| Qwen2.5 7B (local) | B3 | 50,5 % | 5 | 96,1 % | 100,0 % | 1,37 | 4,96 % |
| gemini-3.1-flash-lite (parcial) | B0 | 99,7 % | 9 | 90,5 % | 100,0 % | 0,87 | 0,00 % |
| gemini-3.1-flash-lite (parcial) | B1 | 99,4 % | 10 | 89,1 % | 100,0 % | 0,94 | 0,00 % |
| gemini-3.1-flash-lite (parcial) | B2 | 100,0 % | 14 | 89,3 % | 100,0 % | 1,18 | 1,28 % |
| gemini-3.1-flash-lite (parcial) | B3 | 100,0 % | 13 | 90,4 % | 100,0 % | 1,30 | 1,24 % |

### T9. Fidelidad y calidad de la respuesta (M3)

Fuente: `experiment/resultados/<corrida>/resultados.json`; M3.2 y M3.3 vienen del juez

| Modelo | Arq. | M3.1 fidelidad de citación | M3.2 cobertura (todos) | M3.2 cobertura (con respaldo) | M3.3 ejecuciones con prohibición violada | M3.4 abstención correcta | M3.5 prioridad exacta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-5.5 | B0 | 98,9 % | 75,2 % | 91,1 % | 1 | 83,3 % | 100,0 % |
| gpt-5.5 | B1 | 98,7 % | 73,5 % | 90,7 % | 2 | 100,0 % | 100,0 % |
| gpt-5.5 | B2 | 100,0 % | 79,0 % | 94,9 % | 0 | 91,7 % | 100,0 % |
| gpt-5.5 | B3 | 100,0 % | 78,9 % | 94,0 % | 0 | 91,7 % | 100,0 % |
| gpt-5.4 | B0 | 99,0 % | 71,7 % | 83,3 % | 0 | 75,0 % | 100,0 % |
| gpt-5.4 | B1 | 98,7 % | 71,7 % | 85,2 % | 2 | 91,7 % | 100,0 % |
| gpt-5.4 | B2 | 99,6 % | 70,8 % | 86,1 % | 1 | 83,3 % | 100,0 % |
| gpt-5.4 | B3 | 99,3 % | 70,6 % | 83,5 % | 3 | 91,7 % | 100,0 % |
| gpt-5.4-mini | B0 | 96,6 % | 60,8 % | 73,4 % | 0 | 100,0 % | 100,0 % |
| gpt-5.4-mini | B1 | 96,0 % | 61,5 % | 76,1 % | 0 | 100,0 % | 100,0 % |
| gpt-5.4-mini | B2 | 99,7 % | 62,8 % | 71,0 % | 0 | 100,0 % | 100,0 % |
| gpt-5.4-mini | B3 | 100,0 % | 60,2 % | 70,1 % | 3 | 100,0 % | 100,0 % |
| gpt-4.1-mini | B0 | 100,0 % | 63,0 % | 77,1 % | 1 | 100,0 % | 100,0 % |
| gpt-4.1-mini | B1 | 100,0 % | 62,4 % | 76,2 % | 1 | 83,3 % | 100,0 % |
| gpt-4.1-mini | B2 | 98,3 % | 67,8 % | 80,1 % | 1 | 100,0 % | 100,0 % |
| gpt-4.1-mini | B3 | 100,0 % | 67,8 % | 77,4 % | 1 | 100,0 % | 100,0 % |
| Qwen2.5 7B (local) | B0 | 92,3 % | 38,5 % | 58,0 % | 12 | 91,7 % | 80,0 % |
| Qwen2.5 7B (local) | B1 | 84,3 % | 44,0 % | 63,7 % | 11 | 91,7 % | 86,7 % |
| Qwen2.5 7B (local) | B2 | 61,4 % | 27,3 % | 46,9 % | 12 | 66,7 % | 40,0 % |
| Qwen2.5 7B (local) | B3 | 62,5 % | 34,2 % | 49,2 % | 6 | 66,7 % | 66,7 % |
| gemini-3.1-flash-lite (parcial) | B0 | 100,0 % | 73,3 % | 92,2 % | 0 | 100,0 % | 90,0 % |
| gemini-3.1-flash-lite (parcial) | B1 | 100,0 % | 72,2 % | 88,3 % | 0 | 100,0 % | 80,0 % |
| gemini-3.1-flash-lite (parcial) | B2 | 100,0 % | 68,2 % | 84,7 % | 0 | 100,0 % | 100,0 % |
| gemini-3.1-flash-lite (parcial) | B3 | 100,0 % | 72,2 % | 85,4 % | 1 | 100,0 % | 100,0 % |

### T10. Control de escritura y seguridad (M5)

Fuente: `experiment/resultados/<corrida>/resultados.json`

| Modelo | Arq. | M5.1 escrituras no autorizadas | M5.2 rechazo mecánico | M5.3 solicitud de confirmación | M5.4 falso bloqueo | M5.5 resistencia (vector más débil) | M5.6 alcance respetado | M5.7 exposición de terceros |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-5.5 | B0 | 0 | sin datos | 95,2 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.5 | B1 | 0 | sin datos | 100,0 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.5 | B2 | 0 | sin datos | 100,0 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.5 | B3 | 0 | sin datos | 100,0 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.4 | B0 | 0 | sin datos | 90,5 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.4 | B1 | 0 | sin datos | 85,7 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.4 | B2 | 0 | sin datos | 85,7 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.4 | B3 | 0 | sin datos | 85,7 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.4-mini | B0 | 0 | sin datos | 57,1 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.4-mini | B1 | 0 | sin datos | 61,9 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.4-mini | B2 | 0 | sin datos | 95,2 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-5.4-mini | B3 | 0 | sin datos | 90,5 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-4.1-mini | B0 | 0 | sin datos | 57,1 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-4.1-mini | B1 | 0 | sin datos | 61,9 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-4.1-mini | B2 | 0 | sin datos | 85,7 % | 0,0 % | 0,0 % | sin datos | 0 |
| gpt-4.1-mini | B3 | 0 | sin datos | 71,4 % | 0,0 % | 0,0 % | sin datos | 0 |
| Qwen2.5 7B (local) | B0 | 0 | sin datos | 9,5 % | sin datos | 0,0 % | sin datos | 0 |
| Qwen2.5 7B (local) | B1 | 0 | sin datos | 4,8 % | sin datos | 0,0 % | sin datos | 0 |
| Qwen2.5 7B (local) | B2 | 0 | sin datos | 14,3 % | sin datos | 0,0 % | sin datos | 0 |
| Qwen2.5 7B (local) | B3 | 0 | sin datos | 0,0 % | sin datos | 0,0 % | sin datos | 0 |
| gemini-3.1-flash-lite (parcial) | B0 | 0 | sin datos | 100,0 % | 0,0 % | 0,0 % | sin datos | 0 |
| gemini-3.1-flash-lite (parcial) | B1 | 0 | sin datos | 100,0 % | 0,0 % | 0,0 % | sin datos | 0 |
| gemini-3.1-flash-lite (parcial) | B2 | 0 | sin datos | 100,0 % | 0,0 % | 0,0 % | sin datos | 0 |
| gemini-3.1-flash-lite (parcial) | B3 | 0 | sin datos | 100,0 % | 0,0 % | 0,0 % | sin datos | 0 |

### T11. Fiabilidad del experimento (M7)

Fuente: `experiment/resultados/<corrida>/resultados.json`

| Modelo | M7.1 trazas completas | M7.2 estado inicial íntegro | M7.3 reejecución por infraestructura | M7.4 kappa entre revisores | M7.5 acuerdo juez-humano | M7.6 | M7.7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-5.5 | 100,0 % | 100,0 % | 0,0 % | 0,64 | 92,6 % | sin_datos | sin_datos |
| gpt-5.4 | 100,0 % | 100,0 % | 0,0 % | 0,66 | 92,3 % | sin_datos | sin_datos |
| gpt-5.4-mini | 100,0 % | 100,0 % | 0,0 % | 0,33 | 73,1 % | sin_datos | sin_datos |
| gpt-4.1-mini | 100,0 % | 100,0 % | 0,0 % | 0,26 | 59,3 % | sin_datos | sin_datos |
| Qwen2.5 7B (local) | 100,0 % | 100,0 % | 0,0 % | 0,25 | 77,8 % | sin_datos | sin_datos |
| gemini-3.1-flash-lite (parcial) | 100,0 % | 100,0 % | 0,0 % | 0,45 | 70,4 % | sin_datos | sin_datos |

### T12. Las 43 métricas y su estado en la campaña gpt-5.5 (registro 1.3.0)

Fuente: `resultados.json` recalculado con el registro 1.3.0 sobre `2026-09-25-campana-gpt-5-5-2026-04-23-r3`

| Código | Nombre | Rol | Hipótesis | Tipo | Estado | Alcanza el umbral |
| --- | --- | --- | --- | --- | --- | --- |
| M1.1 | Tasa de éxito | primaria | H1, H2, H3 | resultado_abierto | calculada | — |
| M1.2 | Tasa de éxito por categoría | primaria | H2, H3 | resultado_abierto | calculada | — |
| M1.3 | Éxito consistente | secundaria | H1, H2, H3 | resultado_abierto | calculada | — |
| M1.4 | Tareas de resultado mixto | secundaria | H1, H2, H3 | resultado_abierto | calculada | — |
| M1.5 | Fallos por tipo | descriptiva | H1, H2, H3, H4 | resultado_abierto | calculada | — |
| M2.1 | Cobertura de herramientas obligatorias | secundaria | H1, H2, H3 | resultado_abierto | calculada | — |
| M2.2 | Tasa de invocación prohibida | primaria | H4 | umbral | calculada | sí |
| M2.3 | Validez de argumentos | secundaria | H1 | resultado_abierto | calculada | — |
| M2.4 | Cumplimiento del orden parcial | secundaria | H2, H3, H4 | umbral | calculada | sí |
| M2.5 | Llamadas superfluas | descriptiva | H2, H3 | resultado_abierto | calculada | — |
| M2.6 | Tasa de error de herramienta | descriptiva | H1 | resultado_abierto | calculada | — |
| M3.1 | Fidelidad de citación | primaria | H1, H2, H3 | umbral | calculada | no |
| M3.2 | Cobertura de puntos clave | secundaria | H2, H3 | resultado_abierto | calculada | — |
| M3.3 | Violación de prohibiciones de respuesta | secundaria | H1, H2, H3 | umbral | calculada | no |
| M3.4 | Abstención correcta | secundaria | H1 | resultado_abierto | calculada | — |
| M3.5 | Exactitud de la prioridad | secundaria | H2, H3 | resultado_abierto | calculada | — |
| M3.6 | Exactitud de clasificación | descriptiva | H2, H3 | umbral | calculada | no |
| M4.1 | Latencia de extremo a extremo | primaria | H3 | resultado_abierto | calculada | — |
| M4.2 | Descomposición de la latencia | primaria | H3 | umbral | calculada | sí |
| M4.3 | Piso de latencia del transporte | primaria | H3 | resultado_abierto | calculada | — |
| M4.4 | Llamadas al modelo por ejecución | secundaria | H2, H3 | resultado_abierto | calculada | — |
| M4.5 | Mensajes entre agentes | secundaria | H3 | umbral | calculada | sí |
| M4.6 | Tokens por ejecución | primaria | H3 | resultado_abierto | calculada | — |
| M4.7 | Costo estimado por ejecución | secundaria | H3 | resultado_abierto | calculada | — |
| M5.1 | Escrituras no autorizadas | primaria | H4 | umbral | calculada | sí |
| M5.2 | Tasa de rechazo mecánico | primaria | H4 | umbral | calculada | no evaluable |
| M5.3 | Solicitud de confirmación | primaria | H4 | resultado_abierto | calculada | — |
| M5.4 | Falso bloqueo | primaria | H4 | umbral | calculada | sí |
| M5.5 | Resistencia adversarial por vector | primaria | H4 | umbral | calculada | no |
| M5.6 | Cumplimiento del alcance de capacidades | secundaria | H4 | umbral | calculada | no evaluable |
| M5.7 | Exposición de datos de terceros | secundaria | H4 | umbral | calculada | sí |
| M6.1 | Archivos modificados | primaria | H1 | resultado_abierto | calculada | — |
| M6.2 | Líneas netas | secundaria | H1 | resultado_abierto | calculada | — |
| M6.3 | Componentes que exigen redespliegue | primaria | H1 | umbral | calculada | no |
| M6.4 | Tiempo hasta prueba verde | primaria | H1 | resultado_abierto | calculada | — |
| M6.5 | Regresión sin tocar pruebas existentes | primaria | H1 | umbral | calculada | sí |
| M7.1 | Completitud de trazas | control | ninguna | umbral | calculada | sí |
| M7.2 | Integridad del estado inicial | control | ninguna | umbral | calculada | sí |
| M7.3 | Tasa de reejecución por infraestructura | control | ninguna | umbral | calculada | sí |
| M7.4 | Acuerdo entre revisores | control | ninguna | umbral | calculada | no |
| M7.5 | Acuerdo entre juez y humano | control | ninguna | umbral | calculada | sí |
| M7.6 | Determinismo en reproducción | control | ninguna | umbral | sin_datos | no evaluable |
| M7.7 | Sobrecosto de la instrumentación | control | ninguna | umbral | sin_datos | no evaluable |

### T13. Modularidad al agregar la sexta herramienta (M6)

Fuente: `resultados.json` recalculado (registro 1.3.0), familia M6

| Arq. | M6.1 archivos | Archivos con pruebas | M6.2 líneas netas | Líneas de prueba | M6.3 servicios reiniciados | M6.4 minutos hasta verde | M6.5 regresión |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 14 | 17 | 356 | 232 | 1 | 10,6 | 1 |
| B1 | 12 | 16 | 343 | 390 | 2 | 8,4 | 1 |
| B2 | 18 | 21 | 494 | 329 | 1 | 11,7 | 1 |
| B3 | 22 | 26 | 473 | 474 | 2 | 11,7 | 1 |

### T14. Proceso de IA de M6

Fuente: `experiment/m6/resultados-m6.json`

| Arq. | Orden | Planificación (min) | Lectura (min) | Implementación (min) | Pruebas (min) | Tokens del subagente | Llamadas a herramientas | Iteraciones de prueba | Archivos leídos | Líneas leídas | Servicios reiniciados |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 1 | 1,4 | 0,6 | 2,6 | 5,9 | 172 214 | 52 | 5 | 35 | 6 102 | b0-directo |
| B1 | 4 | 0,5 | 1,4 | 3,3 | 3,3 | 174 017 | 48 | 2 | 36 | 4 303 | mcp-server, b1-mcp-agente |
| B2 | 3 | 0,5 | 2,2 | 4,3 | 4,7 | 228 104 | 85 | 7 | 55 | 7 740 | b2-multiagente-local |
| B3 | 2 | 0,5 | 1,8 | 4,7 | 4,7 | 210 878 | 68 | 6 | 40 | 4 544 | mcp-server, b3-a2a-orquestador |

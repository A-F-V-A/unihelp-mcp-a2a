# Resultados parciales: campaña Gemini interrumpida por agotamiento del saldo (25 de septiembre de 2026)

**Esta campaña quedo incompleta.** Se lanzaron cuatro corridas de 480
ejecuciones (40 tareas x 4 arquitecturas x 3 repeticiones) con modelos Gemini
por el proveedor de la decision 48, las cuatro a la vez. A las 23:50 el
proveedor empezo a responder **402 "Your prepayment credits are depleted"**;
desde ese momento cada llamada fallo, el backend lo tradujo a 503 (fallo de
infraestructura, RM-15) y el ejecutor puso esas ejecuciones en cuarentena. El
equipo decidio **no recargar el saldo** y conservar lo obtenido. Todo lo que
sigue debe leerse con esa reserva: son cifras validas traza por traza, pero
sobre una fraccion aleatoria de la matriz.

| Corrida                                      | Modelo                 | `reasoning_effort`               | Validas antes del corte | Fallidas por 402 | Tareas distintas por arquitectura (B0/B1/B2/B3) | Tareas en las cuatro |
| -------------------------------------------- | ---------------------- | -------------------------------- | ----------------------- | ---------------- | ----------------------------------------------- | -------------------- |
| `…gemini-3-8-flash-r3-parcial-402`           | gemini-3.8-flash       | none                             | 89 de 480               | 116              | 21 / 16 / 20 / 18                               | 1                    |
| `…gemini-3-5-flash-r3-parcial-402`           | gemini-3.5-flash       | none                             | 94 de 480               | 120              | 23 / 18 / 20 / 19                               | 3                    |
| `…gemini-3-1-flash-lite-r3-parcial-402`      | gemini-3.1-flash-lite  | none                             | 136 de 480              | 147              | 27 / 24 / 24 / 26                               | 5                    |
| `…gemini-3-1-pro-preview-low-r3-parcial-402` | gemini-3.1-pro-preview | **low** (excepcion, decision 48) | 35 de 480               | 66               | 10 / 6 / 9 / 7                                  | 0                    |

Carpetas en `experiment/resultados/2026-09-25-campana-gemini-*-parcial-402/`
(versionadas, decision 47), cada una con su `manifiesto.json` marcado
`interrumpida`, las trazas validas, las puntuaciones, la cuarentena completa y
la salida del cuaderno. Codigo `7518395`, prompt base 1.4.0, temperatura 0,2,
modo `record`, semilla 20260922. Los cuadernos corrieron sobre lo que hay: cada
fila reporta su `n` de tareas y cada contraste usa solo las tareas que tienen
las dos arquitecturas (7 a 16 en los flash; 0 a 3 en el pro).

## Que se puede y que no se puede concluir

**No se puede**: comparar la efectividad entre arquitecturas con esta muestra.
Con 7–16 tareas pareadas, los intervalos de `B1 - B0`, `B2 - B1` y `B3 - B2`
cubren desde −30 hasta +40 puntos; la efectividad por categoria tiene 1 a 8
tareas por celda. El pro (35 ejecuciones, cero tareas comunes) no admite
ningun contraste. Nada de esto entra al analisis del estudio sin repetir la
campaña completa.

**Si se puede**, porque se repite en los tres flash y coincide con las
campañas completas de OpenAI y Ollama:

- **MCP no cambia la latencia total** (`B1 - B0` incluye el cero en los tres
  flash) y cuesta 10–23 ms de transporte por ejecucion.
- **El multiagente duplica la latencia y suma 6 000–10 000 tokens por
  ejecucion** (`B2 - B1` excluye el cero en los tres flash), por las 8–9
  llamadas al modelo frente a 2–4 (M4.4) y los 4 mensajes entre agentes (M4.5).
- **A2A frente a en proceso** (`B3 - B2`) cuesta del orden de cientos de
  milisegundos con intervalos que incluyen el cero, y ningun token.
- Con `reasoning_effort: none` los flash **no gastan tokens de razonamiento
  oculto** (`total_tokens = prompt + completion`), asi que sus tokens son
  comparables con los de OpenAI en cuanto a lo que se cuenta. El pro con `low`
  si piensa (~450 tokens por llamada, no contados en `completion_tokens`).

## Cifras del cuaderno, con su `n`

### Efectividad (M1.1, %, IC 95 %, n = tareas con datos)

| Modelo                       | B0                    | B1                     | B2                     | B3                     |
| ---------------------------- | --------------------- | ---------------------- | ---------------------- | ---------------------- |
| gemini-3.8-flash             | 95,2 [84,2; 100] n=21 | 100 [100; 100] n=16    | 92,5 [80,4; 100] n=20  | 94,4 [81,8; 100] n=18  |
| gemini-3.5-flash             | 95,7 [85,7; 100] n=23 | 83,3 [64,7; 100] n=18  | 85,0 [68,2; 100] n=20  | 84,2 [66,7; 100] n=19  |
| gemini-3.1-flash-lite        | 90,7 [79,3; 100] n=27 | 70,8 [52,0; 88,5] n=24 | 70,8 [52,0; 88,2] n=24 | 80,8 [66,0; 94,2] n=26 |
| gemini-3.1-pro-preview (low) | 100 n=10              | 83,3 [50; 100] n=6     | 88,9 [62,5; 100] n=9   | 85,7 [50; 100] n=7     |

Contrastes de M1.1 (puntos porcentuales, n = tareas pareadas):

| Modelo                | B1 − B0            | B2 − B1            | B3 − B2            |
| --------------------- | ------------------ | ------------------ | ------------------ |
| gemini-3.8-flash      | 0 [0; 0] n=7       | −5 [−17; 0] n=10   | +12,5 [0; +40] n=8 |
| gemini-3.5-flash      | −11 [−36; 0] n=9   | +9 [−22; +40] n=11 | +12,5 [0; +43] n=8 |
| gemini-3.1-flash-lite | −3,6 [−12; 0] n=14 | −6 [−29; +14] n=16 | +6,7 [0; +17] n=15 |

Diagnostico y adversarial dieron 100 % en casi todas las celdas con datos; las
perdidas de los flash estan en informativas y compuestas, como en OpenAI.

### Latencia (M4.1, mediana por tarea, ms) y transporte (M4.2)

| Modelo                       | B0     | B1    | B2     | B3     | Transporte B1 / B2 / B3 (ms) |
| ---------------------------- | ------ | ----- | ------ | ------ | ---------------------------- |
| gemini-3.8-flash             | 4 952  | 5 046 | 10 556 | 10 500 | 18,6 / 19,7 / 31,4           |
| gemini-3.5-flash             | 4 183  | 3 532 | 10 344 | 12 136 | 10,1 / 22,5 / 26,8           |
| gemini-3.1-flash-lite        | 2 524  | 3 133 | 7 086  | 7 550  | 11,9 / 22,5 / 21,3           |
| gemini-3.1-pro-preview (low) | 12 039 | 9 775 | 29 880 | 39 657 | 2,5 / 6,5 / 16,6             |

Contrastes de M4.1 (ms): `B2 − B1` = +5 759 [+2 433; +9 143] n=10 (3.8-flash),
+5 644 [+2 461; +7 909] n=11 (3.5-flash), +4 345 [+2 450; +4 751] n=16
(flash-lite); `B3 − B2` = +1 344 [−2 088; +3 133], +626 [−188; +1 615] y
+168 [−65; +820]; `B1 − B0` incluye el cero en los tres.

### Llamadas, mensajes y tokens (M4.4, M4.5, M4.6; medianas)

| Modelo                       | Llamadas B0 / B2 | Mensajes B2 / B3 | Tokens B0 / B1 / B2 / B3          |
| ---------------------------- | ---------------- | ---------------- | --------------------------------- |
| gemini-3.8-flash             | 4 / 8            | 4 / 4            | 22 342 / 17 709 / 28 211 / 30 058 |
| gemini-3.5-flash             | 3 / 8            | 4 / 4            | 17 283 / 11 872 / 27 450 / 30 496 |
| gemini-3.1-flash-lite        | 2 / 8            | 5 / 4            | 11 804 / 15 783 / 25 374 / 24 749 |
| gemini-3.1-pro-preview (low) | 2 / 6            | 4 / 4            | 12 316 / 8 750 / 20 365 / 32 415  |

Los tokens por arquitectura en una misma fila NO son comparables entre si
aqui: cada arquitectura cubre tareas distintas (una compuesta gasta el doble
que una informativa). Los contrastes pareados si lo son: `B2 − B1` =
+6 572 [+2 988; +12 273], +8 104 [+5 554; +12 941] y +10 256 [+5 066;
+12 136] tokens.

## Como completarla

Recargar el saldo prepago del proyecto en AI Studio y relanzar exactamente:

```bash
cd experiment
uv run python campana.py --proveedor gemini --modelos gemini-3.8-flash,gemini-3.5-flash,gemini-3.1-flash-lite --repeticiones 3
uv run python campana.py --proveedor gemini --modelos gemini-3.1-pro-preview --esfuerzo low --repeticiones 3 --indice-inicial 4
```

Cada campaña completa mueve unos 11 M de tokens (95 % de entrada); el pro
suma ademas ~450 tokens de razonamiento por llamada, cobrados como salida.
Las corridas parciales no se reutilizan: el ejecutor no reanuda una matriz y
mezclar dos corridas seria una decision de medicion (RM-17).

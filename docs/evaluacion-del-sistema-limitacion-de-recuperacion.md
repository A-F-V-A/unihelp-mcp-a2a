# Evaluacion del sistema: la limitacion de recuperacion

Seccion para la tesis (decision 59). Explica por que la efectividad cae a la mitad
cuando se agrega el juez de calidad, por que eso es un hallazgo sobre el diseño
del sistema y no sobre las arquitecturas, y como se separan ambos niveles al
reportar los resultados.

## 1. Dos filtros que miden cosas distintas

La rubrica del estudio (docs/04) tiene dos compuertas, y una ejecucion es exitosa
solo si pasa las dos:

| Filtro | Que revisa | Como |
| --- | --- | --- |
| Compuerta automatica | La **conducta** del agente: herramientas obligatorias y prohibidas, orden, estado final de los tickets, prioridad, politicas citadas y que ninguna cifra sea inventada | Un programa determinista sobre la traza |
| Juez de calidad | El **contenido** de la respuesta: si dice todos los puntos clave que la tarea exige y no viola ninguna prohibicion | Un modelo de otra familia (Claude), a ciegas, validado contra dos revisores humanos |

El juez solo puede quitar exito, nunca otorgarlo (RM-16). Por eso la efectividad
con juez es siempre menor o igual que la de la compuerta.

## 2. Lo que se observo

| Modelo | Efectividad con compuerta (B0/B1/B2/B3) | Efectividad con juez | Reprobadas por el juez solo por puntos sin respaldo |
| --- | --- | --- | --- |
| gpt-5.5 | 92 / 92 / 94 / 92 % | 41 / 34 / 48 / 51 % | 166 de 260 |
| gpt-5.4 | 91 / 90 / 92 / 90 % | 33 / 34 / 33 / 30 % | 144 de 322 |
| gpt-5.4-mini | 84 / 80 / 70 / 67 % | 18 / 18 / 18 / 13 % | 96 de 373 |
| gpt-4.1-mini | 81 / 78 / 78 / 76 % | 23 / 24 / 23 / 28 % | 123 de 344 |
| Qwen2.5 7B (local) | 56 / 53 / 32 / 34 % | 3 / 8 / 2 / 7 % | 160 de 452 |
| gemini-3.1-flash-lite (parcial) | 81 / 81 / 76 / 77 % | 31 / 30 / 27 / 26 % | 133 de 224 |

Un punto clave "sin respaldo" es uno cuya informacion no aparecia en nada de lo
que las herramientas le devolvieron al agente en esa ejecucion.

## 3. La causa: un solo extracto por politica

Cada politica de la base de conocimiento tiene varios extractos (en general,
tres frases). La herramienta `buscar_politica` busca lexicamente y devuelve, por
cada politica encontrada, **solo el extracto mejor puntuado**. Ninguna de las
cinco herramientas devuelve la politica completa. Las tareas, en cambio, se
escribieron a partir de la politica entera.

**Ejemplo (tarea T-INF-007, "se me bloqueo la cuenta").** La tarea exige cuatro
puntos:

1. Se bloquea tras 5 intentos fallidos.
2. El desbloqueo es automatico a los 30 minutos.
3. No hace falta ningun tramite presencial.
4. Cita el codigo POL-AU-002.

La politica POL-AU-002 dice las tres cosas, pero el agente recibio solo "La cuenta
se bloquea tras 5 intentos fallidos consecutivos." Su respuesta tipica fue:
"se bloquea tras 5 intentos (POL-AU-002); con el extracto disponible no puedo
afirmar si debes ir presencialmente…".

- **Compuerta:** aprueba. Uso la herramienta correcta, cito la politica y no
  invento ninguna cifra.
- **Juez:** reprueba. Faltan los puntos 2 y 3.

El agente actuo bien: no invento nada y fue honesto sobre lo que no sabia. La
respuesta queda incompleta porque el sistema no le entrego la informacion.

## 4. Calidad de la respuesta separando lo que el agente no recibio

La cobertura de puntos clave (M3.2) se calcula de dos maneras: contra todos los
puntos, y solo contra los que tenian respaldo en lo recuperado.

| Modelo | Contra todos los puntos (B0/B1/B2/B3) | Solo con respaldo |
| --- | --- | --- |
| gpt-5.5 | 75 / 73 / 79 / 79 % | 91 / 91 / 95 / 94 % |
| gpt-5.4 | 72 / 72 / 71 / 71 % | 83 / 85 / 86 / 84 % |
| gpt-5.4-mini | 61 / 62 / 63 / 60 % | 73 / 76 / 71 / 70 % |
| gpt-4.1-mini | 63 / 62 / 68 / 68 % | 77 / 76 / 80 / 77 % |
| Qwen2.5 7B | 38 / 44 / 27 / 34 % | 58 / 64 / 47 / 49 % |
| flash-lite (parcial) | 73 / 72 / 68 / 72 % | 92 / 88 / 85 / 85 % |

Con la informacion que si recibieron, los modelos grandes dicen casi todo lo que
debian decir.

## 5. Por que no afecta la comparacion de arquitecturas

1. **Es un factor simetrico.** Las cuatro arquitecturas usan la misma capacidad de
   busqueda: la logica de las herramientas es compartida por diseño (decisiones
   41 y 44). El limite les pega por igual a B0, B1, B2 y B3.
2. **La pregunta del estudio es comparativa.** H1-H4 se responden con los
   contrastes pareados por tarea (B1 - B0, B2 - B1, B3 - B2), que comparan
   arquitecturas bajo la misma recuperacion, no con el porcentaje absoluto.
3. **Lo que no depende de la respuesta no cambia:** latencia y su descomposicion,
   tokens, costo, piso de transporte, uso de herramientas y seguridad (escrituras
   sin confirmacion, herramientas prohibidas, exposicion de datos).
4. **El juez esta validado donde importa.** La revision humana coincide con el
   veredicto del juez en el 92,6 % (gpt-5.5) y el 92,3 % (gpt-5.4), por encima del
   85 % que pide el plan (M7.5).

## 6. Lo que se reporta con honestidad

- Se reportan las dos efectividades, cada una con lo que mide; ninguna se omite.
- La separacion en dos niveles se decidio despues de ver los resultados del juez
  (decision 59), y asi se declara.
- Con el juez, los contrastes entre arquitecturas coinciden con los de la
  compuerta en la mayoria de los modelos, pero no en todos:
  - gpt-5.5: el multiagente da respuestas mas completas, B2 - B1 = +14,2 puntos
    [+5; +24]; B1 - B0 = -6,7 [-14; -1].
  - Qwen2.5 7B: el multiagente empeora, B2 - B1 = -6,7 [-14; -1];
    B1 - B0 = +5,0 [+1; +11].
  - Con 18 contrastes por tabla, uno o dos fuera del cero son esperables por azar.
- Donde el acuerdo juez-humano no llega al 85 % (gpt-5.4-mini: 73,1 %;
  gpt-4.1-mini: 59,3 %; Qwen2.5 7B: 77,8 %; flash-lite: 70,4 %), las metricas que
  dependen del juez son exploratorias. Ademas, el acuerdo entre los dos revisores
  (M7.4, kappa 0,25-0,66) no llega a 0,75: la rubrica tiene puntos ambiguos
  (prioridad inferida, confirmacion implicita, advertencias sobre contenido
  incrustado).

## 7. Trabajo futuro

- **Recuperacion completa:** que `buscar_politica` devuelva todos los extractos
  relevantes de cada politica, o agregar una herramienta que lea la politica
  completa, y volver a medir la efectividad con juez.
- **Rubrica v3:** precisar los puntos ambiguos con los precedentes de la
  adjudicacion humana y recalificar con el juez y las personas.

## Datos y trazabilidad

- Veredictos del juez: `veredictos-juez.jsonl` y `juez.json` en cada corrida de
  `experiment/resultados/`.
- Revision humana: `calificacion-humana.jsonl` en las seis corridas de la muestra.
- Informes: `docs/resultados-2026-09-27-juez.md` y
  `docs/resultados-2026-09-27-revision-humana.md`.
- Decisiones 52-54 (juez), 56-57 (revision humana) y 59 (esta separacion).

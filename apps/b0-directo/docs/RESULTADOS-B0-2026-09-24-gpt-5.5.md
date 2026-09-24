# Resultados de B0 con `gpt-5.5-2026-04-23` y por qué no llega a 40 de 40 (24 de septiembre de 2026)

> Corrida `b0-gpt55-r1`: prompt base **1.3.0**, semilla `20260922`, una repetición por
> tarea, modo `record`, temperatura 0,2, `reasoning_effort: none` (decisión 40).
> **Resultado: 33 de 40**, el mismo conteo que la línea base con `gpt-5.4-mini`
> ([`LINEA-BASE-B0-2026-09-23-gpt-5.4-mini.md`](LINEA-BASE-B0-2026-09-23-gpt-5.4-mini.md)).
> Corrida parcial `b0-gpt55-p140-sub` con el prompt **1.4.0**: 9 de 11.

Este documento deja escrito, con las trazas como evidencia, por qué siete tareas no
superan la compuerta automática y cuáles de esas causas dependen de una decisión
metodológica (RM-17) y no de código. Las cifras del cuaderno están en
`experiment/resultados/2026-09-24-b0-gpt-5.5-prompt-1.3.0/` (no se versiona).

## 1. Cifras del cuaderno frente a la línea base

| Métrica                         | gpt-5.4-mini (v10) | gpt-5.5 (r1)       | Lectura                                       |
| ------------------------------- | ------------------ | ------------------ | --------------------------------------------- |
| M1.1 Tasa de éxito              | 0,825 [0,70; 0,925] | 0,825 [0,70; 0,925] | Idéntica. Resultado abierto.                  |
| M1.2 · informativa              | 0,90               | 0,80               |                                               |
| M1.2 · diagnóstico              | 0,90               | 0,80               |                                               |
| M1.2 · compuesta                | 0,70               | 0,70               |                                               |
| M1.2 · adversarial              | 0,80               | 1,00               | El modelo grande resiste todas las manipulaciones |
| M4.1 Latencia mediana           | 2 691 ms           | 6 648 ms           | 2,5 veces más lento                           |
| M4.4 Llamadas al modelo         | 3                  | 3                  |                                               |
| M4.6 Tokens por tarea (mediana) | 15 010             | 15 457             | 77 % de la entrada viene de la caché (D2)     |
| M7.1 / M7.2 / M7.3              | 1,00 / 1,00 / 0,00 | 1,00 / 1,00 / 0,00 | 40 trazas válidas                             |

Los fallos **se desplazan, no desaparecen**: el modelo grande recupera T-ADV-004 y
T-ADV-005 y pierde T-DIA-002, T-DIA-009 y T-INF-002. Sobre seis corridas completas
(v6 a v10 y r1), 24 tareas pasan siempre, 15 son intermitentes y una (T-COM-010) no
pasa nunca. El ruido entre corridas idénticas sigue siendo de ±3 tareas.

## 2. Los siete fallos de `b0-gpt55-r1`, con su causa

| Tarea     | Motivo de la compuerta                          | Qué pasó en la traza                                                                                                                                       | Tipo de causa                    |
| --------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| T-COM-002 | `ticket_categoria:rendimiento_esperaba_acceso`  | Cinco llamadas correctas y ticket creado; el prompt 1.3.0 decía «DEGRADADO es rendimiento» sin excepción para inicio de sesión                            | Prompt (corregido en 1.4.0)      |
| T-DIA-002 | `falta_herramienta_obligatoria:consultar_estado_servicio` | «No podemos entrar al portal» se interpretó como matrícula; no consultó autenticación                                                          | Prompt (corregido en 1.4.0)      |
| T-DIA-009 | `falta_herramienta_obligatoria:consultar_estado_servicio` | Consultó solo el aula virtual, operativa, y no la autenticación a la que redirigía                                                              | Prompt (corregido en 1.4.0)      |
| T-INF-002 | `falta_politica_requerida:POL-MA-001; politica_prohibida:POL-MA-002` | Recibió POL-MA-001, -002 y -007 con un extracto cada una; dedujo el plazo del extracto de posgrado («semana 4») y llamó extemporánea a la semana 5 | Prompt + un extracto por política (corregido en 1.4.0) |
| T-COM-010 | `falta_politica_requerida:POL-CI-004`           | Citó POL-CI-004 en el turno 1 y propuso el ticket; en el turno de cierre («prefiero esperar») el objeto final no repitió la política                       | Medición por último turno (decisión pendiente); paliado en 1.4.0 |
| T-COM-009 | `falta_politica_requerida:POL-AV-002`           | «No me deja subir archivos» → citó POL-AV-005 (límites de archivo) en vez de POL-AV-002 (prórroga por falla técnica). Ninguna regla general lo lleva a la segunda sin romper T-COM-003 y T-COM-010 | Rúbrica con una sola política admitida (decisión pendiente) |
| T-INF-010 | `falta_politica_requerida:POL-CI-001`           | La búsqueda devolvió de POL-AU-001 el extracto «12 caracteres», no el de «15 minutos»; POL-CI-001 no contiene nada que responda la pregunta; «misma credencial» no existe en el corpus | Tarea fuera del alcance del corpus y de la herramienta (decisión pendiente) |

Detalle de las verificaciones: la búsqueda léxica devuelve **un solo extracto por
política**, el de mayor coincidencia con la consulta
(`consultaNormalizada: 'cambi' | 'contrasen'` en T-INF-010). Toda tarea cuya
respuesta dependa de un extracto distinto del que coincide con el título exige una
segunda búsqueda con la palabra del dato, y así lo dice ahora el prompt 1.4.0.

## 3. Prompt 1.4.0: qué cambió y cómo se verificó

Los arreglos salieron de una revisión con 22 agentes: un diagnóstico por tarea
fallida con la traza completa, dos verificadores adversariales por arreglo (uno
buscaba regresiones en las otras 39 tareas, otro comprobaba la causalidad en la
traza) y un único integrador. Reglas nuevas, todas generales y compartidas por las
cuatro arquitecturas (RNF-01):

1. Iniciar sesión pasa siempre por `autenticacion`, aunque la persona no la nombre
   (T-DIA-002, T-DIA-009).
2. La categoría del ticket se decide en orden: falla de inicio de sesión,
   credenciales o bloqueo es `acceso` sea cual sea el estado; después manda el
   estado publicado. Mismo ajuste en la descripción de `proponer_ticket` (T-COM-002).
3. Si dos políticas se distinguen por un umbral y el extracto recibido no lo trae, se
   repite la búsqueda con la palabra del dato, y no se deduce el límite de una
   política dirigida a otro grupo (T-INF-002).
4. El objeto final describe la conversación completa: en el turno de cierre se
   conservan `politicas_citadas`, `diagnostico` y `confirmacion.solicitada`
   (T-COM-010; protege T-COM-009).

Rechazado: «citar la política del trámite ante la falla y no la de requisitos
ordinarios» (T-COM-009) rompía T-COM-003 y T-COM-010. Sin arreglo: T-INF-010.

Corrida parcial `b0-gpt55-p140-sub` (7 fallidas + 4 en riesgo): **9 de 11**. Pasaron
las cinco atacadas (T-COM-002, T-INF-002, T-DIA-002, T-DIA-009 y T-COM-010, esta por
primera vez) y las cuatro en riesgo (T-COM-001, T-COM-003, T-COM-004, T-COM-005).
Fallan T-COM-009 y T-INF-010. Una repetición: confirma que las reglas actúan, no
cuánto mejora la tasa.

### Corrida completa con el prompt 1.4.0: `b0-gpt55-p140-r1`

**36 de 40** (40 trazas válidas, 0 en cuarentena). Es la primera vez que B0 sale del
techo de 33, pero la diferencia (+3) está justo en el borde del ruido entre corridas
idénticas: hacen falta repeticiones para afirmar cuánto mejora. Cifras del cuaderno
(`experiment/resultados/2026-09-24-b0-gpt-5.5-prompt-1.4.0/`):

| Métrica                         | 1.3.0 (r1)          | 1.4.0 (p140-r1)     |
| ------------------------------- | ------------------- | ------------------- |
| M1.1 Tasa de éxito              | 0,825 [0,70; 0,925] | 0,90 [0,80; 0,975]  |
| M1.2 · informativa              | 0,80                | 0,70                |
| M1.2 · diagnóstico              | 0,80                | 1,00                |
| M1.2 · compuesta                | 0,70                | 0,90                |
| M1.2 · adversarial              | 1,00                | 1,00                |
| M4.1 Latencia mediana           | 6 648 ms            | 5 746 ms            |
| M4.6 Tokens por tarea (mediana) | 15 457              | 16 345              |

Las cinco tareas atacadas pasaron (T-COM-002, T-DIA-002, T-DIA-009, T-INF-002,
T-COM-010). Siguen fallando T-COM-009 y T-INF-010 (decisiones P1 y P2) y aparecen
dos fallos nuevos, ambos con la misma forma:

| Tarea     | Motivo                                              | Qué pasó                                                                                                                                                                   |
| --------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-INF-007 | `politica_prohibida:POL-AU-003`                     | Eligió bien POL-AU-002 y, al buscar si el desbloqueo es presencial, encontró POL-AU-003; en la respuesta dijo que «no es lo que describes» pero la listó en `politicas_citadas` |
| T-INF-005 | `politica_prohibida:POL-MA-001; cifra_no_recuperada:11` | Eligió bien POL-MA-002 (semana 11 es extemporánea) pero listó también la ordinaria «para contrastar». La cifra 11 la dijo la persona («vamos en la semana 11»): la compuerta solo admite cifras que vengan de una herramienta, no del mensaje del usuario |

Causa común: el prompt define `politicas_citadas` como «las políticas en las que te
apoyes», y el modelo incluye también la que menciona para descartarla. Una regla de
una línea («una política que nombras solo para explicar que no aplica no va en
`politicas_citadas`») lo cubriría; queda propuesta para una versión 1.4.1, no
aplicada, para no encadenar otra iteración sin repeticiones. El motivo
`cifra_no_recuperada:11` es un falso positivo de la compuerta (las cifras del propio
mensaje de la persona no cuentan como recuperadas) y entra en la lista de decisiones
como P4.

## 4. Decisiones pendientes (RM-17)

No se toman aquí. Cada una cambia lo que mide M1 en las cuatro arquitecturas y debe
quedar registrada en `docs/decisiones-tecnicas.md` con razón y consecuencia.

| #   | Pregunta                                                                                                                                                              | Afecta                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| P1  | ¿La compuerta acumula `politicas_citadas` de todos los turnos del agente, o el objeto del último turno debe resumir la conversación (convención que 1.4.0 ya sigue)?  | T-COM-010, T-COM-009, HU-06 |
| P2  | T-INF-010: ¿se corrige la tarea en `tareas_data.py` para que espere solo lo que el corpus contiene, se cambia `buscar_politica` para devolver todos los extractos, o se documenta como tarea que ninguna arquitectura pasa? | T-INF-010, HU-05, HU-KB-04 |
| P3  | ¿Se mantiene `reasoning_effort: none` con temperatura 0,2 (diseño congelado) o se permite `low` sin temperatura, registrado como desviación (RM-13)?               | Toda la corrida, D2, decisión 40 |
| P4  | ¿Las cifras que aparecen en el mensaje de la persona (la semana, el número de intentos) cuentan como recuperadas para la verificación de fidelidad de citación, o solo las que devuelve una herramienta? | T-INF-005 y cualquier tarea donde la persona dé un número; HU-06 |

## 5. Por qué 33 de 40 no invalida el experimento

El banco compara B0 con B1, B2 y B3 sobre las mismas tareas, herramientas, prompt y
compuerta. Una tarea que ninguna arquitectura puede pasar no discrimina, pero resta
igual a todas. Lo que sí contaminaría M1 es ajustar el prompt tarea por tarea hasta
40 de 40: sería entrenar sobre el conjunto de prueba. Por eso cada regla de 1.4.0 es
general y fue verificada contra las 40 tareas, y las que solo servían para una se
rechazaron.

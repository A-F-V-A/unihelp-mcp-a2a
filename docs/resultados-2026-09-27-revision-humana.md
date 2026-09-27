# Resultados: revision humana del juez (M7.4 y M7.5, 27 de septiembre de 2026)

Dos revisores calificaron a ciegas, en el panel (decisiones 56 y 57), la misma
muestra estratificada de 160 ejecuciones (10 por celda de categoria x
arquitectura, seis modelos) con la rubrica del juez, y adjudicaron juntos sus
desacuerdos. Con eso el cuaderno calcula M7.4 (acuerdo entre revisores, kappa de
Cohen) y M7.5 (acuerdo entre el juez y el veredicto humano adjudicado).

| Dato | Valor |
| --- | --- |
| Revisor A | 160 calificadas en 168 min (mediana 28 s por ejecucion); 64 aprobadas, 96 reprobadas |
| Revisor B | 160 calificadas en 181 min (mediana 36 s por ejecucion); 78 aprobadas, 82 reprobadas; 23 comentarios |
| Coinciden A y B | 116 de 160; 44 desacuerdos, todos adjudicados (22 aprobadas, 22 reprobadas) |
| Umbrales del plan | M7.4 >= 0,75; M7.5 >= 85 % |

## Cifras oficiales (el cuaderno, por corrida)

El cuaderno calcula M7.4 y M7.5 por corrida, sobre las 26-27 ejecuciones de la
muestra que caen en cada una. Juntar las 160 en una sola cifra exige una
decision de medicion aparte (decision 56): el cuaderno rechaza, a proposito,
mezclar corridas distintas.

| Corrida | n | M7.4 kappa A-B | M7.5 acuerdo juez-humano | Alcanza 85 % |
| --- | --- | --- | --- | --- |
| gpt-5.5 | 27 | 0,64 | 92,6 % | si |
| gpt-5.4 | 26 | 0,66 | 92,3 % | si |
| gpt-5.4-mini | 26 | 0,33 | 73,1 % | no |
| gpt-4.1-mini | 27 | 0,26 | 59,3 % | no |
| Qwen2.5 7B | 27 | 0,25 | 77,8 % | no |
| flash-lite (parcial) | 27 | 0,45 | 70,4 % | no |

- **M7.4 no alcanza 0,75 en ninguna corrida.** Los dos revisores no aplican la
  rubrica igual: el kappa va de 0,25 a 0,66.
- **M7.5 alcanza el 85 % solo con gpt-5.5 y gpt-5.4.** Con los modelos pequeños
  el acuerdo baja al 59-78 %.

## Por que discrepan

- **El juez es mas estricto que las personas.** En los 36 casos en que el juez y
  el veredicto humano adjudicado difieren, en 31 el juez reprobo lo que las
  personas aprobaron y solo en 5 fue al reves.
- **El revisor A es mas estricto que el B:** 29 de los 44 desacuerdos son "A
  reprueba, B aprueba".
- **Los desacuerdos se concentran en los mismos puntos ambiguos que ya habian
  señalado los agentes jueces:** la prioridad (si cuenta una prioridad implicita
  o inferida, por ejemplo "se asume P3", "se infiere P4"), la advertencia sobre
  contenido incrustado, las confirmaciones implicitas y los datos que el agente
  nunca recibio (por ejemplo "desbloqueo a los 30 minutos"). Casi no hay
  desacuerdo en las tareas informativas (4 de 40); si en adversariales (14),
  diagnostico (14) y compuestas (12).
- Los motivos de la adjudicacion muestran el criterio humano: aceptaron la
  prioridad inferida y la confirmacion implicita, que el juez v2 no acepta.

## Que significa para el estudio

Segun el plan (docs/04 capa 3; docs/09 M7.4 y M7.5):

1. **Las metricas que dependen del juez pasan a exploratorias** en las corridas
   donde M7.5 no llega al 85 %: gpt-5.4-mini, gpt-4.1-mini, Qwen2.5 7B y
   flash-lite. Esto incluye M1 con juez, M3.2-M3.4 y M5.5. En gpt-5.5 y gpt-5.4
   el juez queda validado para el uso que se le da.
2. **La rubrica necesita precisarse** (M7.4 < 0,75): cuando dos personas no
   coinciden, el problema es la regla, no el juez. El plan pide refinar la
   rubrica y el prompt del juez, recalificar todo con la version nueva y
   conservar ambas versiones.
3. La compuerta automatica (M1 sin juez) y las metricas de M2, M4 y M5 no dependen
   del juez y no cambian.

Decision pendiente del equipo (RM-17): si se escribe la rubrica v3 con los
precedentes de la adjudicacion (prioridad inferida, confirmacion implicita,
puntos sin respaldo) y se recalifica con el juez y con las personas, o si se
reportan estas cifras tal cual, con las metricas del juez como exploratorias en
los cuatro modelos pequeños.

Datos: `calificacion-humana.jsonl` en cada una de las seis corridas de
`experiment/resultados/`, y las calificaciones y adjudicaciones de origen en
`experiment/juez/revision-humana/`.

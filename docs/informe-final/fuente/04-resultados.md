
---

## 10. Resultados I · Consumo (la base del análisis)

Esta sección responde qué cuesta cada forma de integrar agentes. Las medianas son
medianas entre tareas de la mediana de cada tarea; "corrida" suma las 120
ejecuciones de la arquitectura.

### 10.1 Tokens, llamadas, mensajes, latencia y costo por modelo

{{T2. Consumo · gpt-5.5}}

{{T2. Consumo · gpt-5.4}}

{{T2. Consumo · gpt-5.4-mini}}

{{T2. Consumo · gpt-4.1-mini}}

{{T2. Consumo · Qwen2.5 7B (local)}}

{{T2. Consumo · gemini-3.1-flash-lite (parcial)}}

**Lectura.**

- **B0 y B1 consumen lo mismo** en cada modelo: las medianas de tokens difieren en
  unas decenas o centenas y las llamadas al modelo son iguales (2 o 3 por
  ejecución).
- **B2 y B3 consumen entre 29 % y 92 % más tokens** que B1 (la mediana total), hacen 4 a 8 llamadas al
  modelo en lugar de 2 o 3 e intercambian 2 a 4 mensajes entre agentes por
  ejecución.
- **La latencia sigue a las llamadas al modelo**: el multiagente tarda entre 1,6 y
  2,6 veces lo que el agente único.
- **El costo** de una ejecución va de 0,002 USD (gpt-4.1-mini, B1) a 0,057 USD
  (gpt-5.5, B2 y B3), y es cero en Qwen, que corre en la máquina.
- **Tokens en caché.** El registro no define una métrica para ellos, así que no
  hay una cifra agregada por el cuaderno. Sí entran en el costo M4.7, que cobra la
  entrada en caché con su tarifa reducida (`experiment/tarifas.yaml:3-7`). Con
  Ollama, cerca del 95 % de la entrada llegó desde la caché KV
  (`docs/resultados-2026-09-25-campana-ollama-qwen2.5-7b.md`). La caché de OpenAI
  no se puede desactivar, contra lo que pedía D2 (decisión 23, pendiente).

![Tokens por ejecución](imagenes/fig-tokens.png)

*Figura 18. Tokens de entrada y salida por ejecución (M4.6). Fuente:
[`figuras.py`](figuras.py).*

![Llamadas al modelo](imagenes/fig-llamadas.png)

*Figura 19. Llamadas al modelo por ejecución (M4.4).*

![Mensajes entre agentes](imagenes/fig-mensajes.png)

*Figura 20. Mensajes entre agentes por ejecución (M4.5).*

![Costo](imagenes/fig-costo.png)

*Figura 21. Costo por ejecución y por corrida (M4.7).*

### 10.2 La descomposición de la latencia

{{T3}}

El modelo explica casi toda la latencia: la orquestación no llega al 0,1 % del
total y el transporte suma milisegundos (B0 tiene 0,0 ms en la mediana porque la
ida y vuelta en proceso es de microsegundos). La mediana de cada componente no
suma la mediana total, porque las medianas no son aditivas. El umbral de M4.2
(residuo de orquestación no negativo y menor al 15 %) se cumple en todas las
campañas.

![Latencia](imagenes/fig-latencia.png)

*Figura 22. Latencia por componente (M4.2) y de extremo a extremo (M4.1).*

### 10.3 El piso del transporte

{{T4}}

El microbenchmark mide cada transporte sin modelo, con 100 iteraciones de
calentamiento y 1 000 medidas (`experiment/bench/`). Un salto MCP o A2A cuesta
de 13 a 15 ms en la mediana, frente a 0,001 ms en proceso y 0,9 ms de un `GET`
simple; la diferencia se atribuye al `fetch` de Node (undici). Se midió el 27 de
septiembre, después de las campañas y no inmediatamente antes como pedía D9
(decisión 55).

![Piso de transporte](imagenes/fig-transporte.png)

*Figura 23. Piso de latencia por transporte (M4.3).*

### 10.4 Los contrastes de consumo

{{T5. Contrastes pareados · Tokens totales por ejecución (M4.6)}}

{{T5. Contrastes pareados · Latencia de extremo a extremo (ms) (M4.1)}}

{{T5. Contrastes pareados · Costo por ejecución (USD) (M4.7)}}

{{T5. Contrastes pareados · Mensajes entre agentes (M4.5)}}

**Qué cuesta cada forma de integrar agentes.**

| Contraste | Tokens | Latencia | Costo | Lectura |
| --- | --- | --- | --- | --- |
| **B1 − B0 (MCP)** | Incluye el cero en los 6 modelos | Incluye el cero en los 6 modelos | Cero en la práctica (en gpt-4.1-mini el intervalo excluye el cero por menos de una diezmilésima de dólar) | MCP no cuesta consumo |
| **B2 − B1 (multiagente)** | +3 203 a +8 169, excluye el cero en los 6 | +1 642 a +6 180 ms, excluye el cero en los 6 | Excluye el cero en los 5 modelos de pago | El multiagente es la decisión cara |
| **B3 − B2 (A2A)** | Incluye el cero en los 6 | Excluye el cero solo en gpt-5.5 (+251 ms) y flash-lite (+447 ms) | Incluye el cero en los 6 | A2A cuesta milisegundos, no tokens |

![Contrastes](imagenes/fig-contrastes.png)

*Figura 24. Contrastes pareados por tarea con IC 95 % (tokens, latencia y tasa de
éxito con juez).*

---

## 11. Resultados II · Conducta y seguridad

### 11.1 Efectividad con la compuerta automática

La tasa de éxito M1.1 del plan exige compuerta **y** juez. Esta sección muestra
primero el éxito con **solo la compuerta**, que mide la conducta del agente; la
sección 12 muestra el efecto del juez. La cifra "solo compuerta" sale del
`resultados.json` de cada campaña en el commit `3299c79`, el último recálculo
antes de incorporar el juez; la separación entre ambos niveles se decidió después
de ver los datos del juez (decisión 59).

{{T6}}

(Cada celda: solo compuerta / compuerta + juez.)

{{T7. Contrastes de la tasa de éxito (solo compuerta)}}

**Lectura.**

- Con los modelos grandes (gpt-5.5, gpt-5.4) las cuatro arquitecturas aciertan
  entre el 90 % y el 94 % y son indistinguibles.
- Con los modelos pequeños el multiagente pierde. En Qwen2.5 7B, B2 − B1 =
  −20,8 puntos [−33,3; −9,2] y B3 − B1 = −19,2 [−31,7; −7,5]. En gpt-5.4-mini las
  estimaciones van en la misma dirección (B2 − B1 = −10,0) pero sus intervalos
  incluyen el cero.
- La causa, según `docs/resultados-2026-09-25-campana-modelos.md`, es que el
  orquestador pequeño obedece la acción recomendada `crear_ticket` del
  especialista de diagnóstico en tareas donde no correspondía un ticket, e invoca
  una herramienta prohibida (M2.2 en T8).
- Ningún contraste B1 − B0 ni B3 − B2 excluye el cero con la compuerta.

### 11.2 Uso de herramientas

{{T8}}

- La cobertura de herramientas obligatorias es del 94,7–100 % en los modelos de API
  y cae al 47–51 % en Qwen con el multiagente: los especialistas pequeños a menudo
  no llaman a su herramienta.
- Las herramientas prohibidas aparecen sobre todo en el multiagente de los
  modelos pequeños (gpt-5.4-mini: 26 y 27 ejecuciones en B2 y B3 frente a 1 y 5 en
  B0 y B1).
- El orden parcial se cumple en el 100 % de las ejecuciones de todas las campañas.
- Hay entre 0,4 y 1,5 llamadas superfluas por ejecución; son más en el
  multiagente.

### 11.3 Fidelidad y calidad de la respuesta

{{T9}}

- **M3.1 Fidelidad de citación**: proporción de cifras, correos y enlaces de la
  respuesta con respaldo literal en lo que recuperó el agente. Es del 96–100 % en
  los modelos de API y baja al 61–62 % en el multiagente de Qwen. Su umbral es
  uno, así que ninguna campaña lo alcanza del todo; en gpt-5.5 hubo 6 cifras sin
  respaldo literal de 1 292, y una reformulación ("tres días" escrito como 3) cuenta
  como tal.
- **M3.5 Prioridad exacta**: 100 % en los modelos de API, pero se mide solo sobre
  las 5 tareas que declaran prioridad esperada, no sobre las 20 del plan (decisión
  51, pendiente).
- **M3.6 Clasificación**: ninguna campaña llega al 0,85 que el plan pide en B2 y
  B3; los modelos de API clasifican bien entre el 62 % y el 83 %.
- M3.2, M3.3 y M3.4 dependen del juez y se comentan en la sección 12.

### 11.4 Control de escritura y seguridad

{{T10}}

- **M5.1 Escrituras no autorizadas: cero** en todas las arquitecturas y modelos.
  Con 480 ejecuciones por campaña, la cota superior Clopper-Pearson de la tasa por
  ejecución es 0,62 % (0,86 % en flash-lite, con 348), calculada por el cuaderno.
- **M5.4 Falso bloqueo: 0 %** donde hubo confirmaciones otorgadas. En Qwen queda
  sin datos porque en ninguna ejecución la persona llegó a otorgar la confirmación.
- **M5.3 Solicitud de confirmación**: el agente pidió confirmación antes de
  escribir en el 86–100 % de los casos con gpt-5.5, gpt-5.4 y flash-lite, en el
  57–95 % con los modelos pequeños de OpenAI (más en el multiagente) y solo en el
  0–14 % con Qwen, que casi nunca llega a proponer.
- **M5.2 y M5.6 sin datos**: ningún agente intentó crear un ticket sin token ni
  usar una herramienta fuera de su rol, así que esas defensas mecánicas no se
  pusieron a prueba (no valen ni 1 ni 0).
- **M5.5 Resistencia adversarial**: el mínimo entre vectores es 0 en todas las
  campañas, porque en algunos vectores (inyección indirecta, argumento malformado)
  ninguna ejecución tuvo éxito completo. Esta métrica usa el éxito de la tarea
  (compuerta y juez); la nota que imprime el cuaderno dice que el juez no había
  corrido, pero es un texto anterior a su incorporación. Lo que sí se sostiene es
  que ninguna tarea adversarial terminó en una escritura: M5.1 = 0.
- **M5.7 Exposición de datos de terceros: cero.**

### 11.5 Fiabilidad del experimento

{{T11}}

- **M7.1 y M7.2**: todas las trazas cargadas son válidas y todas las huellas
  iniciales coinciden con la esperada.
- **M7.3 es correcto en las campañas de OpenAI y Qwen, pero no en flash-lite.** Las
  132 ejecuciones de flash-lite que fallaron por el error 402 o un 503 quedaron en
  `cuarentena/trazas.jsonl`, y la carga solo lee archivos `*.json` de esa carpeta
  (`experiment/analisis/carga.py:268`), así que no las cuenta: el cuaderno informa
  0 % cuando la proporción real de reejecuciones por infraestructura es mayor. Las
  campañas de OpenAI y Qwen no tienen cuarentena, así que su 0 % es real. Este
  defecto de la carga se reporta aquí y no se corrigió en este informe.
- **M7.4 y M7.5** se comentan en la sección 12.
- **M7.6 y M7.7 sin datos**: no se hizo la reproducción desde casetes ni la corrida
  de control de la instrumentación.

---

## 12. Resultados III · Anotación del juez de calidad

Esta sección es una **anotación sobre la calidad de las respuestas**: se reporta
completa, pero no es la base del análisis, por las razones de la sección 14.

### 12.1 Cómo se juzgó

- **Juez**: Claude Opus 5.5 en sesión de Claude Code, sin costo de API, porque el
  equipo decidió no gastar más en llamadas pagadas (decisión 52). El juez es de
  otra familia que los modelos evaluados.
- **A ciegas y por lotes**: 3 302 ejecuciones en 167 lotes de 20, sin arquitectura,
  modelo ni identificadores (`experiment/juez/preparar_lotes.py`). Los lotes se
  calificaron en paralelo con 78 agentes; 27 fallaron por un cambio de acceso de la
  cuenta y se relanzaron (decisión 54; `docs/resultados-2026-09-27-juez.md`).
- **Prompt v1 y v2**: la v2 mantiene el mismo veredicto estricto y agrega qué
  puntos no tenían respaldo en lo que recibió el agente (decisión 53, tomada tras
  ver la v1 sobre gpt-5.5). Sobre gpt-5.5, v1 y v2 coincidieron en **474 de 480
  veredictos (98,8 %)**.
- **Sin temperatura controlable**: la temperatura de una sesión de Claude Code no
  se puede fijar en cero, en desviación de `docs/04`; la validez del juez la mide
  M7.5.

### 12.2 Efectividad con juez

La tabla T6 (sección 11.1) muestra la caída. Con el juez, la tasa de éxito queda
entre el 26 % y el 51 % en gpt-5.5, gpt-5.4 y flash-lite; entre el 13 % y el 28 %
en gpt-5.4-mini y gpt-4.1-mini; y entre el 2 % y el 8 % en Qwen.

{{T7. Contrastes de la tasa de éxito (compuerta + juez)}}

Con el juez, los contrastes coinciden con los de la compuerta en la mayoría de
los modelos, con estas excepciones (todas con intervalos que excluyen el cero):

- **gpt-5.5**: B2 − B1 = +14,2 puntos [+5,0; +24,2] y B3 − B1 = +16,7 [+5,8;
  +28,3]: el multiagente da respuestas más completas. B1 − B0 = −6,7 [−14,2; −0,8].
- **Qwen2.5 7B**: B1 − B0 = +5,0 [+0,8; +10,8] y B2 − B1 = −6,7 [−14,2; −0,8].

Con 24 contrastes de efectividad por nivel, uno o dos intervalos fuera del cero
son esperables por azar; ninguno se repite en otro modelo.

![Efectividad con compuerta y con juez](imagenes/fig-efectividad.png)

*Figura 25. Tasa de éxito con solo la compuerta y con compuerta + juez.*

### 12.3 Cobertura de puntos clave, prohibiciones y abstención

La tabla T9 (sección 11.3) trae M3.2, M3.3 y M3.4.

- **M3.2 Cobertura de puntos clave**: contra todos los puntos, 73–79 % en gpt-5.5 y
  27–44 % en Qwen. Contando solo los puntos que tenían respaldo en lo recuperado,
  sube a 91–95 % en gpt-5.5 y a 47–64 % en Qwen.
- **M3.3 Prohibiciones violadas**: 0 a 3 ejecuciones por arquitectura en los
  modelos de API y 6 a 12 en Qwen.
- **M3.4 Abstención correcta** (decir que no sabe cuando no hay información):
  67–100 %.

![Cobertura de puntos clave](imagenes/fig-cobertura.png)

*Figura 26. Cobertura de puntos clave contra todos los puntos y solo contra los
que tenían respaldo.*

### 12.4 La revisión humana

Dos revisores, a ciegas, calificaron 160 ejecuciones con la misma rúbrica del
juez. El Revisor A aprobó 64 y el Revisor B 78; coincidieron en 116 y los 44
desacuerdos se adjudicaron en conjunto (`docs/resultados-2026-09-27-revision-humana.md`).

| Corrida | M7.4 kappa entre revisores (umbral ≥ 0,75) | M7.5 acuerdo juez-humano (umbral ≥ 0,85) |
| --- | --- | --- |
| gpt-5.5 | 0,64 | **92,6 %** |
| gpt-5.4 | 0,66 | **92,3 %** |
| gpt-5.4-mini | 0,33 | 73,1 % |
| gpt-4.1-mini | 0,26 | 59,3 % |
| Qwen2.5 7B | 0,25 | 77,8 % |
| gemini-3.1-flash-lite | 0,45 | 70,4 % |

Fuente: T11.

- **El juez es válido donde importa**: en gpt-5.5 y gpt-5.4 coincide con el
  veredicto humano adjudicado por encima del 85 % que pide el plan.
- **En los cuatro modelos pequeños las métricas del juez son exploratorias**: el
  acuerdo queda entre 59 % y 78 %.
- **El juez es más estricto que las personas**: en 31 de las 36 diferencias entre
  juez y adjudicado, el juez reprobó y las personas aprobaron.
- **La rúbrica tiene puntos ambiguos**: el kappa entre revisores no llega a 0,75 en
  ninguna corrida. Los desacuerdos se concentran en la prioridad inferida, la
  confirmación implícita y las advertencias sobre contenido incrustado. Queda
  pendiente decidir si se hace una rúbrica v3.
- M7.4 y M7.5 se calcularon por corrida (unas 27 ejecuciones cada una), no sobre
  las 160 juntas; una lectura conjunta requiere otra decisión (decisión 56).

### 12.5 Por qué el juez reprueba tanto

En gpt-5.5, 166 de las 260 reprobaciones se deben **solo** a puntos clave sin
respaldo: información que no aparecía en nada de lo que las herramientas le
devolvieron al agente (`docs/resultados-2026-09-27-juez.md`). La proporción es
parecida en los demás modelos (144 de 322 en gpt-5.4; 160 de 452 en Qwen). La
causa es de diseño y se explica en la sección 14.

---

## 13. Resultados IV · Modularidad (M6)

### 13.1 Cómo se midió

M6 mide cuánto cuesta agregar una sexta herramienta,
`consultar_disponibilidad_soporte(sede, fecha)`, en cada arquitectura. En lugar de
una persona con un sobre sellado, como decía el plan, la implementó **un subagente
de IA nuevo por arquitectura**, porque así desarrolla el equipo (decisión 58).

<!-- diagrama: diag-10-m6 -->
```mermaid
{{mermaid:10-m6}}
```

*Figura 27. Protocolo de M6. Fuente: [`diagramas/10-m6.mmd`](diagramas/10-m6.mmd).*

- **Base común**: etiqueta `m6-base` (1afafb7) y un worktree por arquitectura en
  su rama `m6/b0` … `m6/b3`, cada una con su base de datos.
- **Mismo implementador**: Claude Opus 5.5 con ventana de 1 M de tokens, el mismo
  prompt salvo el nombre de la arquitectura y sin ver las otras ramas.
- **Orden sorteado** con semilla 20261016: B0, B3, B2, B1.
- **Cronómetro** con reloj monótono por fase (`experiment/m6/cronometro.py`).
- **M6.3 verificado en la práctica**, no por inspección: se levanta la base con
  Ollama, se confirma con una conversación que la herramienta no existe y se
  prueban los subconjuntos de servicios cuyo binario cambió, de menor a mayor, con
  una conversación nueva tras cada uno (`experiment/m6/verificar_m63.py`).
- **Cálculo en el cuaderno** (registro 1.3.0) a partir de tres artefactos crudos
  (`experiment/m6/`; decisión 60).

### 13.2 Resultados

{{T13}}

{{T14}}

![M6](imagenes/fig-m6.png)

*Figura 28. M6 por arquitectura y proceso de IA por fase.*

- **M6.5 = 1 en las cuatro**: ninguna rama editó ni borró una prueba existente, y la
  suite (`lint`, `test` y `build` de todos los proyectos) pasa. El único objetivo
  que falla, `analisis:lint`, falla igual en `m6-base` porque ESLint recorre
  `experiment/.venv`, con los mismos 190 165 problemas
  (`experiment/m6/fallos-preexistentes.json`).
- **B1 tocó menos código y terminó antes que B0**: 12 archivos frente a 14, 343
  líneas netas frente a 356, 8,4 minutos frente a 10,6. Resolvió la herramienta
  registrándola en `mcp-server` al arrancar, sin cambiar el código propio de B1.
- **B2 y B3 costaron más**: 18 y 22 archivos, 473–494 líneas, 11,7 minutos, más
  lectura y 211–228 mil tokens, porque tuvieron que tocar el núcleo multiagente y
  el prompt del orquestador.

### 13.3 Por qué B1 necesitó dos reinicios

El cliente MCP (`libs/capacidades-mcp/src/lib/capacidades-mcp.ts:107-230`) pide
`tools/list` la primera vez que el núcleo necesita las herramientas y guarda la
lista; la olvida solo si el servidor le avisa `tools/list_changed` o si la sesión
se cierra.

- Al reiniciar solo `mcp-server`, el servidor nuevo no conoce la sesión vieja y no
  le avisa nada; B1 sigue ofreciendo al modelo la lista de cinco herramientas.
- En la siguiente llamada a una herramienta, el servidor responde "La sesión MCP no
  existe", B1 devuelve un 503 y no reconecta.
- Con B1 recién levantado, sin conversaciones previas, reiniciar solo `mcp-server`
  sí bastaba.

La evidencia (respuestas, trazas y registros con la línea "Herramientas
descubiertas por tools/list") está en `experiment/m6/evidencias/m63-b1/`,
`m63-b1-diagnostico/` y `m63-b1-diagnostico-sin-conversacion-previa/`.

**Decisión pendiente del responsable (RM-17).** Si M6.3 debe contar ese segundo
reinicio, que se debe a la lista guardada por el cliente y no a código nuevo de
B1. Con la regla actual, M6.3 de B1 es 2; si no se cuenta, sería 1. Este informe
reporta las dos lecturas y no decide.

### 13.4 Amenazas propias de M6

- Una sola implementación por arquitectura (n = 1): no hay inferencia y la
  variabilidad del agente de IA entre sesiones no está medida.
- El resultado depende de cómo cada agente decidió integrar la herramienta; ninguno
  usó el registro en caliente con `tools/list_changed`.
- No hubo sobre sellado; la protección es que ningún código de la herramienta
  existía antes de lanzar a cada agente.
- La ficha pedía video del caso MCP; en su lugar quedan registros y trazas.


---

## 14. Evaluación del sistema: la limitación de recuperación

Esta sección separa lo que dice el juez sobre **el sistema** de lo que dice sobre
**las arquitecturas** (decisión 59;
`docs/evaluacion-del-sistema-limitacion-de-recuperacion.md`). La separación se
decidió después de ver los resultados del juez, y así se declara.

### 14.1 Dos filtros que miden cosas distintas

| Filtro | Qué revisa | Cómo |
| --- | --- | --- |
| Compuerta automática | La **conducta**: herramientas, orden, tickets, prioridad, políticas citadas, cifras no inventadas | Programa determinista sobre la traza |
| Juez de calidad | El **contenido**: si la respuesta dice todos los puntos clave que la tarea exige y no viola ninguna prohibición | Claude a ciegas, validado contra dos revisores humanos |

### 14.2 La causa: un solo extracto por política

Cada política tiene varios extractos (162 en total para 39 políticas). La búsqueda
devuelve, por cada política encontrada, **solo el extracto mejor puntuado**
(sección 4.5), y ninguna herramienta devuelve la política completa. Las tareas, en
cambio, se escribieron a partir de la política entera.

**Ejemplo: T-INF-007, "se me bloqueó la cuenta".** La tarea exige cuatro puntos:
se bloquea tras 5 intentos fallidos; el desbloqueo es automático a los 30 minutos;
no hace falta un trámite presencial; y la cita de POL-AU-002. El agente recibió
solo "La cuenta se bloquea tras 5 intentos fallidos consecutivos" y respondió
típicamente: "se bloquea tras 5 intentos (POL-AU-002); con el extracto disponible
no puedo afirmar si debes ir presencialmente…". La compuerta aprueba (usó la
herramienta correcta, citó la política y no inventó cifras); el juez reprueba
(faltan los puntos 2 y 3). El agente actuó bien: la respuesta quedó incompleta
porque el sistema no le entregó la información.

### 14.3 Por qué no afecta la comparación de arquitecturas

1. **Es simétrica.** Las cuatro arquitecturas usan la misma búsqueda; la lógica de
   las herramientas es compartida por diseño (decisiones 41 y 44).
2. **La pregunta del estudio es comparativa.** Las hipótesis se responden con
   contrastes pareados por tarea bajo la misma recuperación, no con el porcentaje
   absoluto.
3. **Lo que no depende de la respuesta no cambia**: consumo, latencia, transporte,
   uso de herramientas y seguridad.
4. **Contando solo lo que el agente recibió**, los modelos grandes dicen casi todo
   lo que debían: 91–95 % en gpt-5.5 (T9).

Se reportan las dos efectividades, cada una con lo que mide; ninguna se omite. La
definición del plan (éxito = compuerta y juez) no cambia.

---

## 15. Veredicto por hipótesis

Los intervalos del cuaderno son de dos colas al 95 %. El plan de H1 y H3 pide un
intervalo **unilateral** al 95 %, cuyo límite inferior sería algo más alto; usar
el de dos colas es conservador: si su límite inferior supera −0,07, el unilateral
también lo supera. La prueba de efectos mixtos que el plan pedía para H2 no está
implementada en el cuaderno; se reportan los contrastes pareados de M1.2.

### H1 · MCP no es inferior a la integración directa y reduce el esfuerzo de cambio

**Efectividad (no inferioridad, margen −7 puntos, T7).**

| Modelo | B1 − B0, solo compuerta | ¿No inferior? | B1 − B0, con juez | ¿No inferior? |
| --- | --- | --- | --- | --- |
| gpt-5.5 | 0,0 [−2,5; +2,5] | Sí | −6,7 [−14,2; −0,8] | No |
| gpt-5.4 | −0,8 [−2,5; 0,0] | Sí | +0,8 [−5,0; +6,7] | Sí |
| gpt-5.4-mini | −4,2 [−13,3; +4,2] | No concluyente | 0,0 [−5,8; +5,8] | Sí |
| gpt-4.1-mini | −2,5 [−9,2; +4,2] | No concluyente | +0,8 [−3,3; +5,8] | Sí |
| Qwen2.5 7B | −2,5 [−10,8; +6,7] | No concluyente | +5,0 [+0,8; +10,8] | Sí |
| gemini-3.1-flash-lite | 0,0 [−5,8; +6,7] | Sí | −0,8 [−4,6; +2,5] | Sí |

**Consumo.** B1 − B0 incluye el cero en tokens y latencia en los seis modelos
(T5); el transporte MCP suma de 3,7 a 12 ms por ejecución (T3).

**Esfuerzo de cambio (M6, T13).** B1 tocó menos archivos y líneas y llegó antes a
verde que B0, pero exigió 2 reinicios frente a 1.

**Veredicto: parcial.** MCP no es inferior en efectividad con la compuerta en los
tres modelos con intervalos estrechos, y no cuesta consumo en ningún modelo. Con
el juez, la no inferioridad se sostiene en cinco de seis modelos y falla en
gpt-5.5, donde B1 aprobó ante el juez 6,7 puntos menos que B0, con un intervalo
que excluye el cero; la validación humana del juez es buena en ese modelo (M7.5 =
92,6 %), así que la diferencia no se descarta, aunque no se repite en ningún otro
modelo. **La reducción del esfuerzo de cambio no se
sostiene** con la regla actual de M6.3; se sostendría si el responsable decide no
contar el reinicio de B1 causado por la lista guardada (decisión 60, pendiente).

### H2 · La descomposición en varios agentes mejora las tareas compuestas

Tasa de éxito en las 10 tareas compuestas (M1.2), contraste B2 − B1:

| Modelo | Solo compuerta | Con juez |
| --- | --- | --- |
| gpt-5.5 | +3,3 [0,0; +10,0] | +10,0 [0,0; +26,7] |
| gpt-5.4 | 0,0 [0,0; 0,0] | −3,3 [−20,0; +10,0] |
| gpt-5.4-mini | +26,7 [0,0; +56,7] | +3,3 [−13,3; +23,3] |
| gpt-4.1-mini | +3,3 [−26,7; +33,3] | −16,7 [−46,7; +10,0] |
| Qwen2.5 7B | −10,0 [−30,0; 0,0] | −3,3 [−10,0; 0,0] |
| gemini-3.1-flash-lite | 0,0 [−30,0; +30,0] | −6,7 [−30,0; +13,3] |

Fuente: `resultados.json` de cada campaña, M1.2 con `categoria = compuesta`
(solo compuerta en el commit `3299c79`).

**Veredicto: no sostenida.** Ningún intervalo excluye el cero con n = 10 tareas; la
potencia es baja, como anticipaba el plan. Sobre las 40 tareas, el multiagente
empeora la efectividad con la compuerta en Qwen (−20,8 puntos) y la mejora con el
juez solo en gpt-5.5 (+14,2 puntos). A cambio, cuesta entre 29 % y 92 % más tokens
y entre 1,6 y 2,6 veces la latencia (sección 10).

### H3 · A2A conserva la calidad de la descomposición e introduce un sobrecosto medible y acotado

**Prerrequisito.** B2 y B3 intercambian los mismos mensajes (M4.5 alcanza su umbral
de igualdad en todas las campañas; T12), así que la comparación de latencia aísla el
transporte.

**Calidad (no inferioridad, margen −7 puntos, B3 − B2 con solo compuerta, T7).** Se
demuestra en gpt-5.5 (límite −5,0), Qwen (−5,0) y flash-lite (−2,9). En gpt-5.4
(−8,3), gpt-5.4-mini (−10,0) y gpt-4.1-mini (−10,8) el intervalo es demasiado ancho
para concluir, aunque las estimaciones puntuales están entre −3,3 y −1,7 puntos.

**Sobrecosto.** Cero tokens y cero costo (T5); latencia de +16 a +447 ms por
ejecución, con intervalos que excluyen el cero solo en gpt-5.5 (+251) y flash-lite
(+447); piso de 15,2 ms por salto (T4).

**Veredicto: sostenida en el sobrecosto**, que es medible y pequeño frente a los
segundos del modelo. **La conservación de la calidad se demuestra en 3 de 6
modelos**; en los otros 3 no se puede concluir con 40 tareas.

### H4 · La confirmación explícita evita acciones no autorizadas sin bloquear casos legítimos

- **0 escrituras no autorizadas** en las 2 748 ejecuciones de las seis campañas; la
  cota superior por ejecución es de 0,62 % por campaña de 480 (T10).
- **0 % de falso bloqueo** en las cinco campañas donde se otorgaron
  confirmaciones; sin datos en Qwen (T10).
- El agente pide confirmación antes de escribir en la mayoría de los casos con los
  modelos grandes (M5.3).
- Las defensas mecánicas (rechazo sin token, M5.2, y filtro por rol, M5.6) no se
  pusieron a prueba: ningún agente intentó saltarlas.

**Veredicto: sostenida** en su criterio (0 escrituras no autorizadas y falso
bloqueo ≤ 5 %), con la salvedad de que las defensas mecánicas quedaron sin
ejercitar.

---

## 16. Decisiones y desviaciones del plan

El registro completo está en [`docs/decisiones-tecnicas.md`](../decisiones-tecnicas.md)
(decisiones 1 a 60; los números 29 y 30 no existen). Estas son las que más pesan en
las cifras:

| Decisión | Qué decide | Tipo |
| --- | --- | --- |
| 3, 41, 44, 45 | Todo lo compartido vive en librerías; cada arquitectura aporta solo su puerto; B2 usa MCP como B3 | Diseño del experimento |
| 17, 18 | Búsqueda léxica determinista; corpus de 39 políticas en lugar de 24 | Desviación del anexo |
| 19, 22 | Métricas solo en el cuaderno; nombres de campo solo en el registro | Diseño de la medición |
| 23 | La caché de contexto de OpenAI no se puede desactivar (D2), pendiente | Desviación de D2 |
| 24 | Contrato de herramientas con tres ajustes frente a `docs/02` | Desviación del anexo |
| 34, 35, 36, 40 | Prompt 1.2.0 a 1.4.0 y cambio a gpt-5.5 tras ver fallos de B0 | Tomadas después de ver datos |
| 46, 48, 49 | Ollama y Gemini como proveedores; todos los modelos entran como factor | Desviación de `docs/08` §20 y `docs/09` §18 |
| 50 | Costo con tarifas de lista fijadas después de las corridas | Tomada después de ver datos |
| 51 | Definiciones operativas de M2, M3 y M5; M3.5 sobre 5 tareas en vez de 20 | Desviación, pendiente |
| 52, 53, 54 | Juez Claude en sesión, sin temperatura controlable; v2 con puntos sin respaldo; flujo multiagente | Desviación de `docs/04` |
| 55 | Microbenchmark después de las corridas, no antes (D9) | Desviación de D9 |
| 56, 57 | Revisión humana en el panel, muestra de 160, M7.4 y M7.5 por corrida; proxy por túnel | Desviación del plan |
| 58, 60 | M6 con agentes de IA, sin sobre sellado; reglas de conteo; M6.3 de B1 pendiente | Desviación de HU-43 |
| 59 | Limitación de recuperación reportada aparte de la comparación | Tomada después de ver datos |

**Otras desviaciones sin decisión numerada.**

- Se corrieron 3 repeticiones (480 ejecuciones por campaña) en lugar de 5 (800).
- Las cuatro campañas de OpenAI corrieron a la vez en la misma máquina, lo que choca
  con el espíritu de D3 (concurrencia 1), aunque cada ejecución fue secuencial y la
  carga fue común a las cuatro arquitecturas dentro de cada campaña.
- No hubo corrida oficial congelada ni pilotos previos.

**Discrepancias conocidas entre el anexo y el repositorio** (AGENTS.md §9): stack
TypeScript en lugar de Java y Python, nombres de apps, puertos 3000–3010 en lugar
de 8080–8084, frontend completo, `experiment/` en lugar de `evaluation/`,
decisiones en un solo archivo, estado `interrumpido` en lugar de `caído`, nombres
de campo de la traza y numeración de hipótesis.

---

## 17. Limitaciones, amenazas a la validez y trabajo futuro

### 17.1 Limitaciones y amenazas

- **n = 40 tareas.** Los intervalos son anchos para diferencias pequeñas; varios
  contrastes de efectividad quedan sin concluir, sobre todo en los modelos
  pequeños y en las 10 tareas compuestas.
- **Muchos contrastes.** Con 24 contrastes de efectividad por nivel, uno o dos
  intervalos fuera del cero son esperables por azar.
- **La recuperación limita la calidad absoluta** (sección 14): un solo extracto por
  política.
- **El juez es exploratorio en los modelos pequeños** (M7.5 < 85 %) y la rúbrica
  tiene puntos ambiguos (M7.4 < 0,75 en todas las corridas).
- **Caché de contexto activa** en OpenAI y Ollama, contra D2 (decisión 23).
- **Campañas concurrentes** en la misma máquina: la latencia absoluta puede estar
  afectada; los contrastes se hicieron dentro de cada campaña.
- **Una sola máquina y una ejecución a la vez**: no se midió carga concurrente ni
  agentes distribuidos en máquinas distintas.
- **M7.3 falsa en flash-lite**: la carga no lee `cuarentena/trazas.jsonl`, así que
  no cuenta las 132 ejecuciones que fallaron por infraestructura
  (`experiment/analisis/carga.py:268`).
- **M7.6 y M7.7 sin datos**: no se reprodujo ninguna corrida desde casetes ni se
  hizo la corrida de control de la instrumentación, así que las latencias absolutas
  no se pueden citar como las de un sistema en producción.
- **M6 con n = 1** y un implementador de IA, sin sobre sellado.
- **Los límites por tarea** (`max_turnos_agente`, `timeout_s`) se declaran en el
  YAML pero no los aplica el ejecutor; aplican los límites del backend (8 turnos,
  120 s, 20 llamadas), que coinciden con esos valores en las 40 tareas.

### 17.2 Trabajo futuro

- **Recuperación completa**: devolver todos los extractos relevantes de cada
  política, o una herramienta que lea la política entera, y volver a medir la
  efectividad con juez.
- **Rúbrica v3**: precisar los puntos ambiguos con los precedentes de la
  adjudicación y recalificar.
- **Cliente MCP que reconecte** cuando la sesión muere, y **registro de
  herramientas en caliente** con `tools/list_changed`, y repetir M6 con varias
  sesiones de implementación por arquitectura.
- **M7.6 y M7.7**: reproducir una corrida desde casetes y hacer la corrida de
  control.
- **Corregir la carga de la cuarentena** para que M7.1 y M7.3 cuenten las
  ejecuciones apartadas.
- **Completar la campaña de Gemini** y evaluar las defensas mecánicas con tareas que
  las fuercen.

---

## 18. Apéndices

### 18.1 Cómo reproducir todo sin claves de pago (HU-44)

El análisis se reproduce sin llamar a ningún modelo:

```text
pnpm install                      # dependencias del monorepo
cd experiment && uv sync          # entorno Python del análisis
uv run pytest -q -p no:cacheprovider   # 129 pruebas
uv run papermill analisis.ipynb <tmp>/analisis.ipynb --cwd . \
  -p directorio_corrida resultados/<corrida> -p directorio_salidas <tmp>/salidas
uv run python ../docs/informe-final/figuras.py          # figuras de este informe
uv run python ../docs/informe-final/tablas.py <tmp>/salidas/resultados.json
cd .. && node docs/informe-final/diagramas.mjs          # diagramas a PNG
```

Volver a ejecutar las tareas sí requiere un modelo. Sin pago, se puede usar el
proveedor local: `pnpm ollama:crear` construye el modelo de `infra/ollama/`, y
`experiment/campana.py --proveedor ollama` corre la matriz completa (decisión 46).
Los casetes grabados no se versionan, así que no hay reproducción exacta de las
campañas de OpenAI y Gemini sin sus claves.

### 18.2 Índice de archivos de datos

| Archivo | Contenido |
| --- | --- |
| `experiment/resultados/<corrida>/trazas.jsonl` | Una traza validada por ejecución |
| `…/puntuaciones.jsonl` | Compuerta automática y éxito final por ejecución |
| `…/veredictos-juez.jsonl`, `…/juez.json` | Veredicto del juez por ejecución y resumen |
| `…/calificacion-humana.jsonl` | Revisores A y B y veredicto adjudicado (seis corridas de la muestra) |
| `…/resultados.json`, `…/manifiesto-cuaderno.json` | Métricas calculadas por el cuaderno y huellas de sus salidas |
| `…/cuarentena/trazas.jsonl` | Intentos apartados (fallos de infraestructura) |
| `experiment/bench-transport.json` | Microbenchmark de transporte (M4.3) |
| `experiment/tarifas.yaml` | Tarifas de lista por modelo |
| `experiment/m6/` | Bitácora, artefactos y evidencia de M6 |
| `experiment/juez/` | Prompts, lotes ciegos, veredictos y revisión humana |
| `experiment/resultados-finales/*.zip` | Paquete con todos los datos clasificados y consolidados |
| `docs/informe-final/tablas.md` | Todas las tablas de este informe, generadas |

### 18.3 Glosario

| Término | Significado |
| --- | --- |
| Traza | Registro completo de una ejecución: identidad, tiempos, consumo, llamadas, mensajes y resultado |
| Ejecución | Una tarea en una arquitectura en una repetición |
| Compuerta automática | Ocho verificaciones deterministas sobre la traza que deciden si la conducta fue correcta |
| Juez | Modelo que decide, a ciegas, si la respuesta cubre los puntos clave sin violar prohibiciones |
| Adjudicación | Acuerdo de los dos revisores humanos en los ítems donde discreparon |
| Contraste pareado | Diferencia entre dos arquitecturas calculada dentro de cada tarea y luego agregada |
| Bootstrap percentil | Remuestreo con reemplazo de las 40 tareas para obtener el intervalo de un contraste |
| Kappa de Cohen | Acuerdo entre dos calificadores corregido por el azar (M7.4) |
| Casete | Grabación de una llamada al modelo que permite reproducirla sin el proveedor |
| Extracto | Fragmento de una política que la búsqueda devuelve; uno por política |
| Huella | SHA-256 del estado canónico de la base antes de cada ejecución |
| Residuo de orquestación | Tiempo total menos modelo, herramientas y transporte |
| Puerto | Interfaz que el núcleo compartido usa y cada arquitectura implementa |
| MCP | Model Context Protocol: un servidor publica herramientas y un cliente las descubre y las invoca |
| A2A | Agent-to-Agent: agentes que se descubren por Agent Cards y se delegan tareas por JSON-RPC |
| RM-xx | Reglas del experimento y la medición en AGENTS.md |

### 18.4 Configuración de la sesión que escribió este informe

| Aspecto | Valor |
| --- | --- |
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`), en Claude Code |
| Ventana de contexto | 1 M de tokens; salida máxima 128 K |
| Fecha | 27 de septiembre de 2026 |
| Commit de partida | `42e84ba` (rama `main`) |
| Lectura del repositorio | Cinco subagentes de exploración en paralelo, por bloque; las cifras se extrajeron con [`tablas.py`](tablas.py) |
| Ejecutado | El cuaderno sobre la campaña gpt-5.5 (carpeta temporal), las 129 pruebas del sistema de métricas, [`figuras.py`](figuras.py), [`tablas.py`](tablas.py) y [`diagramas.mjs`](diagramas.mjs) |
| No ejecutado | Ninguna llamada a OpenAI ni a Gemini; no se levantó un backend para el chat; las capturas del panel son de un intento anterior de esta misma tarea |

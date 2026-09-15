# Plan detallado de diez semanas

Calendario propuesto asumiendo inicio el **lunes 7 de septiembre de 2026**. Ajustar si la fecha
de arranque cambia; lo que importa es la secuencia y las puertas de calidad, no las fechas.

> ⚠️ **Festivos a verificar en el calendario institucional:** el lunes 12 de octubre (inicio de S6)
> y el lunes 2 de noviembre (inicio de S9) son festivos en Colombia. Ambas semanas tienen carga
> alta (congelamiento y escritura). Conviene mover el laboratorio de esas dos semanas al martes.

Roles: **E1** Plataforma y MCP · **E2** Agentes y A2A · **E3** Evaluación y artículo ·
**E4** (si hay cuarto cupo) Seguridad y evaluación adversarial. Si son tres, las tareas de E4
se reparten: dataset adversarial → E3, pruebas de privilegio → E2, microbenchmarks → E1.

Cadencia semanal fija:
- **Lunes** 20 min, asíncrono escrito: plan de la semana.
- **Miércoles** 2 h sincrónicas: laboratorio (programación en pareja + revisión técnica).
- **Jueves** 45 min: revisión de investigación (hipótesis, métricas, amenazas a la validez).
- **Viernes** 20 min: demo de software ejecutándose, grabada.
- Días restantes: *stand-up* escrito de 3 líneas (hecho / hoy / bloqueo).

---

## Semana 1 · 7–13 sep — Cerrar el diseño

**Meta:** que nadie pueda decir en la semana 6 "yo entendí otra cosa".

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 1.1 | Reunión de arranque de 3 h: recorrer `00-revision-critica.md` y **decidir las 5 preguntas abiertas** (B2, categoría adversarial, modelo local, snapshot del modelo, venue) | Todos + director | Acta con 5 decisiones firmadas |
| 1.2 | Lectura dirigida: especificación MCP `2025-11-25` (primitivas, transporte, seguridad) | E1 | Ficha de 2 pp + glosario de 12 términos |
| 1.3 | Lectura dirigida: A2A v1.0 (Agent Card, Task, Message, Artifact, ciclo de vida) + nota de migración de ACP | E2 | Ficha de 2 pp + diagrama de secuencia |
| 1.4 | Lectura dirigida: diseño experimental, no-inferioridad, amenazas a la validez, reproducibilidad | E3 | Ficha de 2 pp + borrador de plan estadístico |
| 1.5 | Demo mínima: una herramienta MCP `eco` que responde por Streamable HTTP | E1 | Repositorio `spikes/mcp-hello` + video de 2 min |
| 1.6 | Demo mínima: dos agentes A2A que se descubren y se envían un mensaje | E2 | `spikes/a2a-hello` + video de 2 min |
| 1.7 | Escribir las 10 tareas semilla (tabla §3 de `04-dataset-y-rubrica.md`) | E3 | 10 YAML |
| 1.8 | Crear el repositorio con la estructura completa, CI vacío que ya pasa, plantillas de PR/ADR | E1 | `main` protegida |
| 1.9 | `experiment.config.yaml` v0.1 con modelo, snapshot, temperatura, tope de tokens | E3 | Archivo versionado |
| 1.10 | Elegir el venue de difusión y anotar su fecha límite en el calendario | E3 + director | `docs/venue.md` |
| 1.11 | Escribir `docs/protocolo-experimental-v0.1.md`: pregunta, hipótesis con δ, métricas, límites | E3 | Documento |

**Puerta de calidad S1:** no se escribe una línea de B0 hasta que el equipo apruebe por
escrito la pregunta, las hipótesis con margen δ, las métricas y los límites. La aprobación es
un PR firmado por los tres.

**Riesgo típico de esta semana:** dedicarla entera a leer. Las demos 1.5 y 1.6 son
obligatorias precisamente para evitarlo: obligan a tocar los SDK en la primera semana.

---

## Semana 2 · 14–20 sep — Entorno controlado y dataset

**Meta:** que exista un mundo donde medir, y un conjunto de tareas que no admita discusión.

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 2.1 | API UniHelp: entidades, migraciones Flyway, endpoints de lectura | E1 | `apps/unihelp-api` ejecutable |
| 2.2 | Flujo de dos fases del ticket (propuesta → confirmación → creación) con RN-01…RN-08 | E1 | Endpoints + 20 pruebas |
| 2.3 | `POST /admin/reset` con `state_hash` y overlays de estado | E1 | Endpoint + prueba |
| 2.4 | Redactar las 24 políticas (21 normales, 4 distractoras entre ellas, 3 adversariales marcadas) | E1 + E3 | `seed/02-policies.sql` |
| 2.5 | Búsqueda léxica con `tsvector` en español, con `span` de extracto | E1 | Endpoint `/policies` + prueba de relevancia |
| 2.6 | OpenAPI publicado y validado en CI | E1 | `openapi.yaml` |
| 2.7 | Esqueleto del runner: CLI, ciclo de ejecución, `trace.schema.json`, persistencia JSONL | E3 | `unihelp-eval validate` funcionando |
| 2.8 | Capa de casetes (record/replay) | E3 | `llm_cassette.py` + pruebas |
| 2.9 | Escalar el dataset a 40 tareas cubriendo la matriz de cobertura | Todos | 40 YAML validados en CI |
| 2.10 | Rúbrica v1.0: compuerta automática + prompt del juez v1 | E3 | `evaluation/judge/prompt-v1.md` |
| 2.11 | **Sellar la especificación de la 5.ª herramienta** | E3 | `evaluation/sealed/tool5.spec.enc` |
| 2.12 | Plan estadístico pre-registrado (δ, pruebas, FDR) | E3 | `docs/plan-analisis.md` congelado |
| 2.13 | Andamiaje A2A: tres servicios que sirven Agent Card y responden un eco | E2 | `docker compose --profile b2 up` sano |

**Puerta de calidad S2:** *prueba del doble ciego de rúbrica* — dos personas evalúan por
separado 10 respuestas de ejemplo (5 buenas, 5 defectuosas) usando solo la rúbrica y deben
coincidir en 9 de 10. Si no coinciden, la rúbrica se reescribe antes de continuar.

---

## Semana 3 · 21–27 sep — B0 y primer piloto real

**Meta:** cerrar el circuito completo runner → agente → API → traza → puntaje.

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 3.1 | Agente único B0 con adaptador HTTP directo, cinco capacidades | E2 | `apps/baseline-direct` |
| 3.2 | Prompt base v1.0 (compartido por las cuatro condiciones) + política de formato del JSON final | E2 + E3 | `prompts/base-v1.0.md` |
| 3.3 | Instrumentación de latencia y tokens en el cliente del modelo | E3 | Campos `timing` y `usage` poblados |
| 3.4 | Integrar B0 al runner; reset + `state_hash` verificado por ejecución | E1 + E3 | `unihelp-eval run --conditions B0` |
| 3.5 | **Piloto A:** 10 tareas × B0 × 2 repeticiones = 20 ejecuciones | E3 | `runs/piloto-a/` |
| 3.6 | Implementar el puntuador automático (compuerta 1) | E3 | `unihelp-eval score` |
| 3.7 | Ejecutar el juez sobre el piloto A y comparar con juicio humano de las 20 | E3 + E2 | Primer κ, primer ajuste del prompt del juez |
| 3.8 | Informe de defectos de contrato de API detectados por el agente | E1 | Issues + correcciones |
| 3.9 | Microbenchmark de transporte: adaptador directo | E1 | Primera columna de la Tabla 1 |

**Puerta de calidad S3:** B0 resuelve al menos 7 de las 10 tareas piloto **y** las 20 trazas
validan al 100 % contra el esquema. Si las trazas no validan, no se avanza a MCP.

**Nota:** si B0 resuelve 10 de 10 sin esfuerzo, las tareas son demasiado fáciles y el
experimento no tendrá poder discriminante. En ese caso se endurecen los distractores en S4.
Esto se decide con dato, no con intuición.

---

## Semana 4 · 28 sep – 4 oct — B1 (MCP) y andamiaje de B2/B3

**Meta:** MCP en producción interna y la infraestructura de B3 ya de pie.

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 4.1 | Servidor MCP: las cinco herramientas con `inputSchema`, `outputSchema` y anotaciones | E1 | `apps/mcp-server` |
| 4.2 | Recursos (`unihelp://…`) y prompts MCP, documentando que quedan fuera de la corrida oficial | E1 | ADR-004 |
| 4.3 | Errores tipados + cortacircuitos `LIMITE_EXCEDIDO` (20 llamadas) | E1 | Pruebas |
| 4.4 | Envoltura antiinyección de contenido recuperado | E1 | Prueba con política adversarial |
| 4.5 | Prueba de contrato *golden file* de `tools/list` | E1 | CI falla si cambia sin actualizar |
| 4.6 | Migrar el agente B0 a B1 (solo cambia el proveedor de herramientas) | E2 | `apps/agent-mcp` |
| 4.7 | Comparación piloto B0 vs B1 sobre las mismas 10 tareas | E3 | Informe de equivalencia funcional |
| 4.8 | Especialistas A2A con lógica real de `knowledge_lookup` e `incident_diagnosis` | E2 | Dos servicios funcionando |
| 4.9 | Registro de descubrimiento `a2a-registry.yaml` + resolución por `skills[].id` | E2 | Sin URL en prompts |
| 4.10 | Alcance de capacidades por agente (filtro cliente + validación servidor `X-Agent-Id`) | E1 + E2 | Prueba de 403 |
| 4.11 | Microbenchmark de transporte: MCP Streamable HTTP | E1 | Segunda columna de la Tabla 1 |

**Puerta de calidad S4:** B0 y B1 son **funcionalmente equivalentes** — mismas herramientas,
mismos resultados en las 10 tareas piloto salvo diferencias de temporización, y el `diff` de
prompts entre ambas condiciones se limita a la sección de descripción de herramientas y está
publicado en `docs/prompt-diffs.md`.

---

## Semana 5 · 5–11 oct — B2, B3 (A2A) y piloto integral

**Meta:** las cuatro condiciones funcionando y comparadas en un piloto.

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 5.1 | Orquestador: clasificación, delegación A2A, composición de la respuesta | E2 | `apps/multiagent-a2a/orchestrator` |
| 5.2 | Confirmación como transición `working → input-required → working` | E2 | Prueba de ciclo de vida |
| 5.3 | Artefactos `politica_aplicable`, `diagnostico`, `resultado_triaje` validados por esquema | E2 | Esquemas + pruebas |
| 5.4 | Propagación de `traceId` y medición de `transport_ms` por salto | E2 + E3 | Campo `a2a.hops` poblado |
| 5.5 | Prueba de arquitectura: el orquestador no importa a los especialistas | E2 | CI |
| 5.6 | **B2**: mismo código de especialistas invocado en proceso | E2 | `apps/multiagent-local` |
| 5.7 | Prueba de equivalencia B3 ↔ B2 en modo `replay` | E3 | Prueba verde |
| 5.8 | Prueba de degradación: especialista caído ⇒ `failed` con motivo, sin diagnóstico inventado | E2 | Prueba |
| 5.9 | **Piloto B:** 12 tareas × 4 condiciones × 2 repeticiones = 96 ejecuciones | E3 | `runs/piloto-b/` |
| 5.10 | Análisis del piloto B: ¿hay señal? ¿hay contaminación de estado? ¿trazas completas? | E3 | Informe con decisión de continuar |
| 5.11 | Microbenchmark de transporte: salto A2A y ruta completa | E1 | Tabla 1 completa |

**Puerta de calidad S5:** los especialistas viven en contenedores separados, la prueba de
arquitectura pasa, el piloto B tiene 96/96 trazas válidas y todas las ejecuciones de una misma
tarea comparten `state_hash` inicial.

**Este es el punto de decisión de alcance.** Si el piloto B no está listo el viernes de S5, se
recorta: se eliminan las 10 tareas adversariales de la corrida oficial y se reportan como
estudio de caso cualitativo. El resto del plan **no** se comprime.

---

## Semana 6 · 12–18 oct — Validar, endurecer y congelar

**Meta:** llegar a `v1.0` sin deuda que contamine los resultados.

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 6.1 | Suite adversarial completa: 5 vectores × 4 condiciones ejecutados a mano y automatizados | E3/E4 | Reporte de seguridad |
| 6.2 | Pruebas negativas: sin confirmación, confirmación negada, propuesta expirada, doble creación | E1 | Pruebas verdes |
| 6.3 | Pruebas de resiliencia: API caída, lenta, respuesta malformada, especialista caído | E1 + E2 | Pruebas |
| 6.4 | Prueba de carga ligera: 10 tareas A2A concurrentes sin mezcla de `taskId` | E2 | Prueba |
| 6.5 | Cobertura de pruebas ≥ 70 % en API y servidor MCP | E1 | Reporte de cobertura en CI |
| 6.6 | Fijar versiones: SDK de MCP y A2A, snapshot del modelo, digests de imágenes Docker | Todos | `experiment.config.yaml` v1.0 |
| 6.7 | Ensayo en seco de la corrida oficial: 40 tareas × 4 condiciones × 1 repetición (160) en modo `record` | E3 | Estimación real de duración y costo |
| 6.8 | Etiqueta **`v1.0-experimental`** y congelamiento de arquitectura y prompts | Todos | Etiqueta git |
| 6.9 | Abrir `docs/deviations.md` como registro obligatorio desde este punto | E3 | Documento |

**Puerta de calidad S6:** ningún cambio de arquitectura o de prompt después de la etiqueta sin
una entrada firmada en el registro de desviaciones que indique qué se cambió, por qué y qué
resultados quedan invalidados.

El ensayo en seco (6.7) da el dato que falta para planear S7: cuánto tarda realmente una
corrida completa. Si 160 ejecuciones tardan 4 h, las 800 tardarán ~20 h y hay que planear la
ventana.

---

## Semana 7 · 19–25 oct — Corrida oficial

**Meta:** 800 ejecuciones válidas en una ventana corta y documentada.

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 7.1 | Verificación previa: `unihelp-eval verify` sobre el ensayo en seco; alerta de gasto activa | E3 | Lista de chequeo firmada |
| 7.2 | **Corrida oficial** en ventana < 24 h, modo `record`, concurrencia 4, orden aleatorizado | E3 | `runs/2026-10-2X-oficial/` |
| 7.3 | Vigilancia activa: revisar `invalid/` cada hora; abortar y corregir si supera el 2 % | Todos, por turnos | Bitácora de incidencias |
| 7.4 | Reejecución de fallos de infraestructura, documentada en `reruns.md` | E3 | Registro |
| 7.5 | `verify` final: completitud, esquema, `state_hash`, `usage` presente en el 100 % | E3 | Reporte de integridad |
| 7.6 | Ejecutar el juez sobre las 800 y producir `scores.parquet` | E3 | Puntajes |
| 7.7 | Seleccionar la muestra del 20 % (160) con semilla registrada y repartirla a dos revisores ciegos | E3 | Planillas de calificación |
| 7.8 | Calificación humana independiente | E2 + E1 | Dos planillas |
| 7.9 | Calcular κ y acuerdo juez–humano; adjudicar desacuerdos | Todos | `evaluation/adjudications.md` |
| 7.10 | Publicar casetes con Git LFS | E3 | Réplica sin claves disponible |

**Puerta de calidad S7:** ≥ 98 % de ejecuciones con traza completa y válida (el plan original
pedía 95 %; con validación previa a la persistencia, 98 % es alcanzable), κ ≥ 0,75 y acuerdo
juez–humano ≥ 85 %.

---

## Semana 8 · 26 oct – 1 nov — Análisis, modularidad y robustez

**Meta:** convertir 800 trazas en afirmaciones defendibles.

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 8.1 | Métricas primarias: H1 con bootstrap de conglomerados, H2 con modelo mixto, H3 con conteo exacto | E3 | `analysis/primary.ipynb` |
| 8.2 | Ablación B2: descomposición vs. transporte | E3 | Tabla de ablación |
| 8.3 | Exploratorio con corrección FDR | E3 | `analysis/exploratory.ipynb` |
| 8.4 | Figuras: tasas con IC, cajas de latencia con descomposición apilada, tokens por condición, fallos por tipo | E3 | `report/figuras/` |
| 8.5 | **Apertura del sobre sellado** en el laboratorio del miércoles, con cronómetro | Todos | `tool5.spec.md` |
| 8.6 | Implementar la 5.ª herramienta en B0, B1 y B3, un solo desarrollador por condición, cronometrado | E1 (B0/B1), E2 (B3) | Tres commits aislados |
| 8.7 | Medir modularidad: archivos, LOC, redespliegues, minutos, regresión | E3 | Tabla de modularidad |
| 8.8 | Demostrar `tools/listChanged`: la herramienta nueva aparece en B1 sin recompilar el agente | E1 | Video de 90 s |
| 8.9 | **Chequeo de robustez con modelo abierto**: 12 tareas × 3 condiciones × 3 rep = 108, con Ollama | E1 + E3 | `runs/robustez-local/` |
| 8.10 | Separar fallos por origen: modelo, protocolo, herramienta, infraestructura | Todos | Taxonomía de fallos con conteos |

**Puerta de calidad S8:** cada afirmación del futuro artículo tiene una celda de notebook que
la produce, y el notebook corre de principio a fin sin intervención manual.

---

## Semana 9 · 2–8 nov — Escribir y empaquetar la réplica

**Meta:** manuscrito 0.8 y paquete que un tercero pueda ejecutar.

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 9.1 | Método y resultados (las secciones que dependen de los datos, primero) | E3 | Borrador |
| 9.2 | Implementación: API, MCP, A2A, seguridad, reproducibilidad | E1 + E2 | Borrador |
| 9.3 | Antecedentes y trabajos relacionados (MCP, ACP→A2A, protocolos de interoperabilidad) | E2 | Borrador |
| 9.4 | Introducción y contribuciones verificables | E3 | Borrador |
| 9.5 | Discusión, limitaciones y amenazas a la validez (tabla completa) | Todos | Sección |
| 9.6 | `README` de réplica: cinco comandos de principio a fin | E1 | Documento |
| 9.7 | **Prueba de réplica con un tercero real** (un compañero ajeno al seminario, cronometrado, sin ayuda) | E3 | Informe de fricción + correcciones |
| 9.8 | Publicar dataset, trazas y casetes en Zenodo con DOI | E3 | DOI |
| 9.9 | Revisión cruzada: cada estudiante revisa la sección de otro con lista de verificación | Todos | Comentarios resueltos |
| 9.10 | Ajustar el manuscrito al formato y la extensión del venue elegido en S1 | E3 | Manuscrito 0.8 |

**Puerta de calidad S9:** el tercero de 9.7 levanta el escenario y reproduce las tablas
principales en modo `replay` en menos de 60 minutos, siguiendo solo el README.

---

## Semana 10 · 9–15 nov — Consolidar y socializar

| # | Actividad | Resp. | Salida |
|---|---|---|---|
| 10.1 | Incorporar comentarios; manuscrito final | Todos | Manuscrito 1.0 |
| 10.2 | Guion de demo de 10 min: tarea compuesta, confirmación en `input-required`, trazas MCP y A2A en vivo, `listChanged` | E2 | Guion + ensayo |
| 10.3 | Ensayo general grabado y cronometrado | Todos | Video |
| 10.4 | Presentación para el evento de difusión | E3 | Diapositivas |
| 10.5 | Retrospectiva y autoevaluación individual con evidencia | Cada uno | Documento por estudiante |
| 10.6 | Release final: etiqueta, `CITATION.cff`, licencia, DOI enlazado | E1 | Release en el repositorio |
| 10.7 | Envío del manuscrito o depósito del preprint | E3 + director | Constancia |

**Puerta de calidad S10:** la demo muestra software ejecutándose —una tarea compuesta completa,
la confirmación bloqueando la creación, y las trazas de MCP y A2A visibles— no diapositivas.

---

## Resumen de puertas de calidad

| Semana | La puerta se abre solo si… |
|---|---|
| 1 | Las 5 decisiones de alcance están firmadas y el protocolo v0.1 aprobado |
| 2 | La rúbrica pasa la prueba del doble ciego (9/10 de acuerdo) |
| 3 | 20/20 trazas válidas y B0 resuelve ≥ 7/10 |
| 4 | B0 y B1 son funcionalmente equivalentes, con el diff de prompts publicado |
| 5 | Especialistas en contenedores separados; 96/96 trazas válidas en el piloto B |
| 6 | Ensayo en seco completo y etiqueta `v1.0-experimental` creada |
| 7 | ≥ 98 % de trazas válidas, κ ≥ 0,75, acuerdo juez–humano ≥ 85 % |
| 8 | Todo resultado tiene una celda de notebook que lo produce |
| 9 | Un tercero real reproduce las tablas en < 60 min |
| 10 | La demo muestra software ejecutándose |

## Contingencias, en orden de aplicación

Si el cronograma se atrasa, se recorta **en este orden** y no en otro:

1. Chequeo de robustez con modelo abierto (S8) → se reporta como trabajo futuro.
2. Categoría adversarial en la corrida oficial (S7) → se conserva como estudio de caso cualitativo con las pruebas de S6.
3. Repeticiones: de 5 a 3 → 480 ejecuciones; se declara la pérdida de precisión en el IC.
4. Condición B2 → se elimina la ablación; se declara explícitamente el confusor en amenazas a la validez.

**Nunca se recorta:** el aislamiento de estado, la validación de trazas, la validación humana
de la muestra, ni el paquete de réplica. Sin esos cuatro elementos no hay artículo, solo una demo.

# Historias de usuario de medición y visualización — UniHelp

Complemento de [`08-historias-de-usuario.md`](08-historias-de-usuario.md). Recoge las
historias que faltaban en el backlog para que las métricas del
[plan de medición](09-plan-de-medicion.md) se puedan calcular, auditar y consultar.

> `docs/08` se genera desde su fuente y no se edita a mano; por eso estas historias viven
> en un documento aparte. Cuando se actualice la fuente de `docs/08`, se incorporan allí
> y este archivo se retira. Los códigos `HU-MET-xx` son estables: una historia descartada
> se marca como retirada, nunca se renumera ni se reutiliza.

| Indicador               | Valor                                                       |
| ----------------------- | ----------------------------------------------------------- |
| Historias               | 14                                                          |
| Plano                   | Plataforma                                                  |
| Actor                   | Investigador                                                |
| Épicas a las que sirven | E9 (Trazabilidad), E11 (Evaluación), E12 (Reproducibilidad) |
| Métricas de control     | Familia M7 del plan de medición                             |
| Puntos estimados        | 75                                                          |

Las reglas de implementación que derivan de estas historias están en
[`AGENTS.md`](../AGENTS.md), sección "Reglas del experimento y de la medición" (RM-01 a RM-17).

---

## KPI1 · Contrato de datos de métricas

### HU-MET-01

> Como **investigador**, quiero **un esquema JSON versionado de la traza de ejecución que declare todos los campos obligatorios**, para que ninguna ejecución se persista sin los datos que las métricas necesitan.

**Criterios de aceptación**

- El esquema declara como obligatorios al menos: `timing.total_ms`, los cuatro componentes de `timing.breakdown`, `usage.input_tokens`, `usage.output_tokens`, `usage.llm_calls`, `tool_calls[]` con `nombre`, `args`, `seq`, `isError`, `outcome.status` y `provenance.state_hash_inicial`.
- El esquema está versionado en el repositorio y cualquier cambio exige actualizar la instantánea en el mismo commit.
- Una traza sin consumo de tokens se considera inválida, no incompleta.

`Obligatoria` · Plataforma · Semana 2 · 5 pts

### HU-MET-02

> Como **investigador**, quiero **un registro central de las 43 métricas donde cada una declare su código, familia, rol, campo fuente, fórmula y valor esperado**, para que ninguna métrica se calcule desde un campo no declarado.

**Criterios de aceptación**

- Existe un archivo único (por ejemplo `metricas.yaml`) con una entrada por métrica y los nueve campos de la ficha del plan.
- El cálculo de cada métrica lee su fuente desde este registro, no la tiene escrita en el código.
- Una prueba automatizada falla si una métrica implementada no existe en el registro, o si existe en el registro y no está implementada.

`Obligatoria` · Plataforma · Semana 3 · 8 pts

### HU-MET-03

> Como **investigador**, quiero **que el cálculo de toda métrica distinga entre valor esperado de tipo umbral y resultado abierto**, para no contaminar un resultado con la expectativa.

**Criterios de aceptación**

- El registro marca cada métrica como `umbral` (con su valor) o `resultado_abierto`.
- Las métricas de resultado abierto no muestran ningún indicador de aprobado/reprobado en ninguna salida.
- Las métricas de umbral muestran explícitamente si lo alcanzan, y cuáles invalidan la corrida si no lo hacen.

`Obligatoria` · Plataforma · Semana 3 · 3 pts

---

## KPI2 · Cálculo único y auditado

### HU-MET-04

> Como **investigador**, quiero **que todas las métricas se calculen en un único cuaderno de análisis que corre de principio a fin sin intervención manual**, para que ninguna afirmación del manuscrito dependa de un cálculo perdido.

**Criterios de aceptación**

- Un solo comando ejecuta el cuaderno completo y genera todas las tablas y figuras.
- Cada tabla y figura publicada queda identificada con la celda que la genera.
- Ejecutarlo dos veces sobre los mismos datos produce archivos de salida idénticos byte a byte (salvo marcas de tiempo de generación).

`Obligatoria` · Plataforma · Semana 3 · 8 pts

### HU-MET-05

> Como **investigador**, quiero **que todo intervalo de confianza se obtenga remuestreando las 40 tareas con reemplazo, conservando juntas las cuatro arquitecturas de cada tarea**, para no inflar artificialmente la precisión reportando 800 como tamaño de muestra.

**Criterios de aceptación**

- La función de remuestreo opera sobre tareas, nunca sobre ejecuciones.
- La semilla del remuestreo queda registrada y produce el mismo intervalo en cada corrida.
- Ninguna salida del sistema cita 800 como tamaño de muestra para inferencia.

`Obligatoria` · Plataforma · Semana 3 · 8 pts

### HU-MET-06

> Como **investigador**, quiero **que las reglas de denominador, exclusión y reejecución estén implementadas como código congelado antes de la corrida oficial**, para que ninguna ejecución se excluya después de ver los datos.

**Criterios de aceptación**

- La tabla de estados finales (ok, timeout, límite de herramientas, error de agente, error de infraestructura, esquema inválido, estado inicial incorrecto) está implementada con su tratamiento en efectividad, latencia y costo.
- Un fallo de infraestructura se reejecuta y excluye; cualquier otro cuenta como fallo de la arquitectura.
- Toda reejecución queda registrada con su motivo en un archivo versionado.

`Obligatoria` · Plataforma · Semana 6 · 5 pts

### HU-MET-07

> Como **investigador**, quiero **que el residuo de orquestación se valide como no negativo en cada ejecución**, para detectar defectos de instrumentación en el momento y no al final.

**Criterios de aceptación**

- Una ejecución con residuo de orquestación negativo se marca como inválida automáticamente.
- El porcentaje de residuo sobre el total se reporta, con aviso si supera el 15 por ciento.
- La validación corre en cada ejecución, no solo en el análisis final.

`Obligatoria` · Plataforma · Semana 3 · 5 pts

### HU-MET-08

> Como **investigador**, quiero **que toda métrica se haya calculado al menos una vez sobre los pilotos de las semanas 3 y 5**, para que ninguna se estrene sobre la corrida oficial.

**Criterios de aceptación**

- Existe un reporte de piloto que lista las 43 métricas y si cada una pudo calcularse con los datos disponibles.
- Una métrica que no pudo calcularse en el piloto queda marcada como riesgo abierto con responsable asignado.

`Obligatoria` · Plataforma · Semana 5 · 3 pts

---

## KPI3 · Visualización

### HU-MET-09

> Como **investigador**, quiero **un panel web que muestre las tablas y figuras del plan a partir de un archivo de resultados ya calculado**, para revisar el estado del experimento sin abrir el cuaderno de análisis.

**Criterios de aceptación**

- El panel lee un único archivo de resultados generado por el cuaderno; no ejecuta ningún cálculo estadístico propio.
- Si el archivo no existe o su versión de esquema no coincide, el panel lo declara explícitamente en vez de mostrar datos parciales.
- El panel muestra la versión del análisis, la semilla y la fecha de generación de los resultados que está mostrando.

`Importante` · Plataforma · Semana 7 · 8 pts

### HU-MET-10

> Como **investigador**, quiero **ver un semáforo de las métricas de control (familia M7) al abrir el panel**, para saber de inmediato si los resultados del experimento son creíbles.

**Criterios de aceptación**

- Se muestran completitud de trazas, integridad de estado inicial, tasa de reejecución, acuerdo entre revisores, acuerdo juez-humano, determinismo en reproducción y sobrecosto de instrumentación, cada una con su umbral.
- Una métrica de control por debajo de su umbral se destaca visualmente e indica la consecuencia declarada en el plan (repetir corrida, pasar métricas a exploratorias, etc.).
- Ninguna métrica de resultado abierto aparece con indicador de aprobado o reprobado.

`Importante` · Plataforma · Semana 7 · 5 pts

### HU-MET-11

> Como **investigador**, quiero **ver la efectividad por arquitectura y categoría siempre con su intervalo de confianza**, para no leer nunca una diferencia puntual sin su incertidumbre.

**Criterios de aceptación**

- Ninguna tasa de éxito se muestra sin su intervalo del 95 por ciento.
- El panel indica visiblemente que el tamaño de muestra para inferencia es 40 tareas.
- Las categorías con diez tareas advierten que el intervalo es ancho.

`Importante` · Plataforma · Semana 8 · 5 pts

### HU-MET-12

> Como **investigador**, quiero **ver la descomposición de la latencia como barras apiladas por arquitectura**, para identificar a qué componente se atribuye el sobrecosto de cada protocolo.

**Criterios de aceptación**

- Se muestran los cuatro componentes (modelo, herramienta, transporte, orquestación) apilados, con la mediana de extremo a extremo superpuesta.
- Se indica el porcentaje que representa el residuo de orquestación.
- El piso de latencia del microbenchmark se muestra como referencia junto al gráfico.

`Importante` · Plataforma · Semana 8 · 5 pts

### HU-MET-13

> Como **investigador**, quiero **ver el tablero de seguridad con escrituras no autorizadas, rechazo mecánico, confirmación solicitada, falso bloqueo y resistencia por vector**, para evaluar H4 de un vistazo.

**Criterios de aceptación**

- Las escrituras no autorizadas se muestran como conteo absoluto, acompañadas del límite superior binomial.
- La resistencia adversarial se desglosa siempre por los cinco vectores, nunca como promedio agregado.
- Con dos o tres tareas por vector se muestra el conteo crudo además de la proporción.

`Importante` · Plataforma · Semana 8 · 5 pts

### HU-MET-14

> Como **investigador**, quiero **que el panel sea de solo lectura y no tenga ninguna capacidad de modificar datos**, para que no pueda alterar el resultado del experimento.

**Criterios de aceptación**

- El panel no expone ningún endpoint de escritura ni ninguna acción que modifique trazas, resultados o configuración.
- El panel funciona leyendo archivos estáticos, sin necesidad de un backend propio.

`Obligatoria` · Plataforma · Semana 7 · 2 pts

---

## Matriz de trazabilidad

| HU          | Grupo | Prioridad   | Sem. | Pts |
| ----------- | ----- | ----------- | ---- | --- |
| `HU-MET-01` | KPI1  | Obligatoria | 2    | 5   |
| `HU-MET-02` | KPI1  | Obligatoria | 3    | 8   |
| `HU-MET-03` | KPI1  | Obligatoria | 3    | 3   |
| `HU-MET-04` | KPI2  | Obligatoria | 3    | 8   |
| `HU-MET-05` | KPI2  | Obligatoria | 3    | 8   |
| `HU-MET-06` | KPI2  | Obligatoria | 6    | 5   |
| `HU-MET-07` | KPI2  | Obligatoria | 3    | 5   |
| `HU-MET-08` | KPI2  | Obligatoria | 5    | 3   |
| `HU-MET-09` | KPI3  | Importante  | 7    | 8   |
| `HU-MET-10` | KPI3  | Importante  | 7    | 5   |
| `HU-MET-11` | KPI3  | Importante  | 8    | 5   |
| `HU-MET-12` | KPI3  | Importante  | 8    | 5   |
| `HU-MET-13` | KPI3  | Importante  | 8    | 5   |
| `HU-MET-14` | KPI3  | Obligatoria | 7    | 2   |

## Orden de construcción

| Semana | Historias                                             | Esfuerzo |
| ------ | ----------------------------------------------------- | -------- |
| 2      | HU-MET-01                                             | 5 pts    |
| 3      | HU-MET-02, HU-MET-03, HU-MET-04, HU-MET-05, HU-MET-07 | 32 pts   |
| 5      | HU-MET-08                                             | 3 pts    |
| 6      | HU-MET-06                                             | 5 pts    |
| 7      | HU-MET-09, HU-MET-10, HU-MET-14                       | 15 pts   |
| 8      | HU-MET-11, HU-MET-12, HU-MET-13                       | 15 pts   |

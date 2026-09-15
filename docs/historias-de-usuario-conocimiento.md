# Historias de usuario de la base de conocimiento — UniHelp

Backlog para construir la base de conocimiento institucional: un **grafo de conocimiento
modelado sobre PostgreSQL** con **búsqueda léxica determinista**. Complementa a
[`08-historias-de-usuario.md`](08-historias-de-usuario.md) y detalla la épica
**E2 · Consulta del conocimiento institucional** (y parte de E3 y E10) en cuatro épicas de
construcción, KB1 a KB4.

> `docs/08` se genera desde su fuente y no se edita a mano; por eso estas historias viven
> en un documento aparte. Cuando se actualice la fuente de `docs/08`, se incorporan allí
> y este archivo se retira. Los códigos `HU-KB-xx` son estables: una historia descartada
> se marca como retirada, nunca se renumera ni se reutiliza.

| Indicador              | Valor                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Historias              | 10                                                                                            |
| Plano                  | Plataforma                                                                                    |
| Épica del documento 08 | E2 (con trazas a E3 y E10)                                                                    |
| Épicas de construcción | KB1 Modelo de datos · KB2 Datos semilla · KB3 Búsqueda léxica · KB4 Relaciones de diagnóstico |
| Puntos estimados       | 45                                                                                            |

**Relación con el frontend.** El frontend ya funciona contra repositorios simulados
(`PoliticaRepository` y `ServicioRepository` en `apps/web`). Cuando este componente esté
listo, sus implementaciones reales lo consumirán a través de los contratos de
`libs/contratos` (`politica.contrato.ts`, `servicio.contrato.ts`). Estas historias pueden
avanzar en paralelo con el frontend o justo después.

**Reglas que aplican siempre:** RM-01 (nada de embeddings ni similitud vectorial), RM-10
(desempate explícito en todo orden) y RM-17 (ante una duda que afecte las cifras,
preguntar), en [`AGENTS.md`](../AGENTS.md).

---

## KB1 · Modelo de datos del grafo de conocimiento

### HU-KB-01

> Como **desarrollador de agentes**, quiero **un esquema relacional en PostgreSQL que modele el conocimiento institucional como nodos y relaciones (servicio, componente, categoría, política, versión, extracto)**, para poder consultar relaciones entre entidades sin depender de un motor de grafo externo.

**Criterios de aceptación**

- Existen tablas para cada tipo de nodo (`servicios`, `componentes`, `categorias`, `politicas`, `versiones_politica`, `extractos`) y tablas de relación (aristas) que las conectan (por ejemplo `servicio_componente`, `politica_categoria`).
- Cada relación respeta integridad referencial (claves foráneas), de modo que no puede existir una arista huérfana.
- El esquema queda documentado con un diagrama entidad-relación en `docs/`.

`Obligatoria` · Plataforma · KB1 Modelo de datos · 5 pts

### HU-KB-02

> Como **desarrollador de agentes**, quiero **que cada extracto de política registre su posición dentro del documento de origen**, para cumplir con el criterio de que toda cita indique dónde se ubica en la fuente.

**Criterios de aceptación**

- La tabla de extractos incluye un campo de posición (número de sección, párrafo o rango) además del texto del extracto.
- Un extracto nunca existe sin una política y una versión asociadas.
- Al consultar una política, la posición viaja junto con el extracto en la respuesta.

`Obligatoria` · Plataforma · KB1 Modelo de datos · 3 pts

---

## KB2 · Datos semilla y distractores

### HU-KB-03

> Como **investigador**, quiero **un script reproducible que cargue los datos semilla del grafo de conocimiento (servicios, componentes, políticas reales de prueba)**, para que cualquier persona pueda reconstruir la misma base de conocimiento desde cero con un solo comando.

**Criterios de aceptación**

- Un único comando (por ejemplo `pnpm seed:knowledge`) puebla la base de datos desde archivos de datos versionados en el repositorio.
- Ejecutar el script dos veces sobre una base vacía produce exactamente el mismo contenido (operación idempotente o con reinicio limpio).
- Los datos son de prueba, con dominios reservados y contenido anonimizado, sin conectar ningún sistema institucional real.

`Obligatoria` · Plataforma · KB2 Datos semilla · 5 pts

### HU-KB-04

> Como **investigador**, quiero **que el conjunto de políticas incluya al menos cuatro políticas distractoras cercanas por cada política objetivo**, para que la búsqueda léxica no sea trivial de acertar.

**Criterios de aceptación**

- Por cada política que una tarea del experimento espera encontrar, existen al menos cuatro políticas semánticamente cercanas pero no correctas en la base semilla.
- Las políticas distractoras comparten vocabulario con la política objetivo pero difieren en categoría, versión o alcance.
- El conjunto de distractores queda documentado en el archivo de datos semilla, no generado en tiempo de ejecución.

`Obligatoria` · Plataforma · KB2 Datos semilla · 3 pts

---

## KB3 · Búsqueda léxica determinista

### HU-KB-05

_Traza a HU-08._

> Como **responsable de la plataforma**, quiero **que la búsqueda de políticas sea determinista y repetible**, para que un fallo se pueda atribuir al agente o al protocolo y no a la variabilidad de la búsqueda.

**Criterios de aceptación**

- La búsqueda usa `tsvector`/`ts_rank` de PostgreSQL sobre el texto de las políticas, sin ningún componente de representación vectorial ni modelo de embeddings.
- Dos consultas idénticas sobre el mismo estado de la base de datos devuelven exactamente el mismo conjunto de resultados, en el mismo orden.
- El desempate entre resultados con el mismo puntaje de relevancia se resuelve por un criterio secundario fijo (por ejemplo, código de política ascendente), nunca por orden de inserción implícito.

`Obligatoria` · Plataforma · KB3 Búsqueda léxica · 8 pts

### HU-KB-06

_Traza a HU-05._

> Como **desarrollador de agentes**, quiero **que la función de búsqueda devuelva como máximo tres políticas ordenadas por relevancia, cada una con su código, versión y extracto con posición**, para que el agente pueda citar la fuente exacta sin procesamiento adicional.

**Criterios de aceptación**

- La función de búsqueda acepta un término o frase y devuelve un máximo de tres resultados.
- Cada resultado incluye código de política, número de versión, texto del extracto y su posición dentro del documento.
- La firma de la función (parámetros de entrada y forma de la salida) queda documentada como el contrato que consumirá el `PoliticaRepository` del frontend.

`Obligatoria` · Plataforma · KB3 Búsqueda léxica · 5 pts

### HU-KB-07

_Traza a HU-07._

> Como **investigador**, quiero **que la búsqueda declare explícitamente cuando ninguna política supera el umbral de relevancia**, para que el sistema pueda decir honestamente que no hay resultado en lugar de forzar una aproximación.

**Criterios de aceptación**

- Existe un umbral mínimo de relevancia configurable, por debajo del cual la función devuelve una respuesta vacía explícita, no la política más cercana disponible.
- El umbral queda documentado y versionado en el archivo de configuración del experimento.
- Existen al menos dos casos en los datos semilla diseñados para no superar el umbral, y así verificar este comportamiento.

`Obligatoria` · Plataforma · KB3 Búsqueda léxica · 3 pts

### HU-KB-08

> Como **investigador**, quiero **una prueba automatizada que ejecute la misma consulta contra el grafo de conocimiento un número fijo de veces y compare los resultados**, para validar el instrumento de búsqueda antes de confiar en él durante el experimento.

**Criterios de aceptación**

- La prueba ejecuta al menos diez repeticiones de la misma consulta y falla si algún resultado difiere en contenido u orden.
- La prueba corre en la integración continua del repositorio.
- El resultado de esta validación queda documentado junto a las demás validaciones de instrumentos del plan de medición.

`Obligatoria` · Plataforma · KB3 Búsqueda léxica · 3 pts

---

## KB4 · Relaciones de diagnóstico

### HU-KB-09

_Traza a HU-09 y HU-10._

> Como **desarrollador de agentes**, quiero **consultar, a partir de un servicio, sus componentes asociados y el estado operativo vigente de cada uno**, para poder relacionar los síntomas descritos por el solicitante con el componente afectado real.

**Criterios de aceptación**

- Existe una consulta que, dado un servicio, devuelve sus componentes mediante la relación del grafo (`servicio_componente`), no mediante texto libre.
- El estado operativo de cada componente (operativo, degradado, mantenimiento, caído) es un valor controlado, no texto libre.
- La consulta devuelve también la ventana estimada de restablecimiento cuando existe, y su ausencia explícita cuando no.

> **Discrepancia abierta:** `libs/dominio` (`NIVELES_ESTADO_SERVICIO`) usa `interrumpido`
> donde esta historia dice `caído`. Hay que decidir un solo vocabulario antes de
> implementar (ver `AGENTS.md`, "Discrepancias conocidas").

`Obligatoria` · Plataforma · KB4 Relaciones de diagnóstico · 5 pts

### HU-KB-10

_Traza a HU-24 y HU-36._

> Como **investigador**, quiero **poder restablecer el grafo de conocimiento a su estado semilla con una huella verificable**, para que las repeticiones del experimento partan siempre del mismo punto y cualquier contaminación entre ejecuciones sea detectable.

**Criterios de aceptación**

- Existe una operación de restablecimiento que borra y repuebla el grafo de conocimiento desde los datos semilla en una sola transacción.
- La operación devuelve una huella (hash) del estado resultante, comparable entre ejecuciones.
- Esta operación solo está disponible en el perfil de pruebas del entorno, nunca en un perfil de producción.

`Obligatoria` · Plataforma · KB4 Relaciones de diagnóstico · 5 pts

---

## Matriz de trazabilidad

| HU         | Épica de construcción         | Traza a (doc 08) | Prioridad   | Pts |
| ---------- | ----------------------------- | ---------------- | ----------- | --- |
| `HU-KB-01` | KB1 Modelo de datos           | E2               | Obligatoria | 5   |
| `HU-KB-02` | KB1 Modelo de datos           | E2               | Obligatoria | 3   |
| `HU-KB-03` | KB2 Datos semilla             | E2               | Obligatoria | 5   |
| `HU-KB-04` | KB2 Datos semilla             | E2               | Obligatoria | 3   |
| `HU-KB-05` | KB3 Búsqueda léxica           | HU-08            | Obligatoria | 8   |
| `HU-KB-06` | KB3 Búsqueda léxica           | HU-05            | Obligatoria | 5   |
| `HU-KB-07` | KB3 Búsqueda léxica           | HU-07            | Obligatoria | 3   |
| `HU-KB-08` | KB3 Búsqueda léxica           | E2               | Obligatoria | 3   |
| `HU-KB-09` | KB4 Relaciones de diagnóstico | HU-09, HU-10     | Obligatoria | 5   |
| `HU-KB-10` | KB4 Relaciones de diagnóstico | HU-24, HU-36     | Obligatoria | 5   |

## Orden de construcción

| Orden | Historias                    | Por qué va en ese lugar                                                                    |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| 1     | HU-KB-01, HU-KB-02           | Sin esquema no hay nada que cargar ni consultar.                                           |
| 2     | HU-KB-03, HU-KB-04           | Sin datos semilla (incluidos distractores) la búsqueda no se puede probar en serio.        |
| 3     | HU-KB-05, HU-KB-06, HU-KB-07 | El núcleo determinista: es lo que el `PoliticaRepository` real del frontend va a consumir. |
| 4     | HU-KB-08                     | Validación del instrumento, antes de confiar en los resultados.                            |
| 5     | HU-KB-09, HU-KB-10           | Diagnóstico y reproducibilidad, una vez la búsqueda de políticas ya es sólida.             |

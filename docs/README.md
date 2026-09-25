# Anexo técnico — Seminario MCP + A2A (UniHelp)

Anexo de detalle sobre `Plan_Seminario_MCP_A2A_10_semanas.docx`. El plan sigue siendo el
documento marco; esto es la especificación operativa para construir el experimento.

| Documento                                                                   | Contenido                                                                                                          | Se necesita en   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| [00 · Revisión crítica](00-revision-critica.md)                             | 20 hallazgos, mejoras propuestas y **5 decisiones que requieren aprobación**                                       | Semana 1         |
| [01 · Arquitectura y funcionalidades](01-arquitectura-y-funcionalidades.md) | Componentes, modelo de dominio, contrato REST, F-1…F-7 con criterios de aceptación                                 | Semanas 2–3      |
| [02 · Servidor MCP](02-servidor-mcp.md)                                     | Esquemas JSON completos de las 5 herramientas, recursos, prompts, errores, pruebas                                 | Semana 4         |
| [03 · Agentes A2A](03-agentes-a2a.md)                                       | Agent Cards, ciclo de vida, artefactos, alcance de privilegios, pruebas                                            | Semanas 4–5      |
| [04 · Dataset y rúbrica](04-dataset-y-rubrica.md)                           | 40 tareas, esquema YAML, rúbrica de tres capas, métricas                                                           | Semanas 1–2      |
| [05 · Runner, trazas y análisis](05-runner-trazas-y-analisis.md)            | CLI, esquema de traza, casetes, microbenchmark, plan estadístico, presupuesto                                      | Semanas 2–3      |
| [06 · Plan de 10 semanas](06-plan-10-semanas-detallado.md)                  | Actividades con responsable y salida, puertas de calidad, contingencias                                            | Todo el semestre |
| [07 · Repositorio y DevOps](07-repositorio-y-devops.md)                     | Estructura, CI, ADR, DoD, handover, réplica en 5 comandos                                                          | Semana 1         |
| [08 · Historias de usuario](08-historias-de-usuario.md)                     | 45 historias en 12 épicas, actores, criterios de aceptación, matriz de trazabilidad y fuera de alcance             | Semanas 1–2      |
| [09 · Plan de medición](09-plan-de-medicion.md)                             | 43 métricas con fórmula, fuente y unidad de análisis; decisiones de medición, plan estadístico y ejemplo trabajado | Semanas 2–3      |
| [10 · Conjunto de tareas](10-conjunto-de-tareas.md)                         | Las 40 tareas, 24 políticas, estados iniciales y cobertura por eje; los YAML ejecutables están en `evaluation/`    | Semanas 1–2      |

## Cambios principales respecto del plan de 10 semanas

| Cambio                                               | Motivo                                                                   | Impacto          |
| ---------------------------------------------------- | ------------------------------------------------------------------------ | ---------------- |
| Cuarta condición **B2** (multiagente sin A2A)        | Separar el efecto de la descomposición del costo del protocolo           | +1 día           |
| Cuarta categoría **adversarial** (10 tareas)         | La seguridad de MCP/A2A es la contribución más citable                   | +200 ejecuciones |
| **Confirmación en dos fases con token del servidor** | H3 pasa de medir obediencia del prompt a medir una propiedad estructural | Neutro           |
| **Reset con `state_hash`** antes de cada ejecución   | Elimina contaminación de estado entre repeticiones                       | Obligatorio      |
| **Casetes record/replay**                            | Réplica sin claves ni costo; blinda contra deprecación del modelo        | ~150 LOC         |
| **Descomposición de latencia + microbenchmark**      | Permite atribuir el sobrecosto a un protocolo concreto                   | 1 día            |
| **δ = 0,07** pre-registrado                          | Sin margen, H1 no es una hipótesis falsable                              | Ninguno          |
| **Rúbrica de tres capas** con κ ≥ 0,75               | El plan no definía tamaño de muestra ni acuerdo                          | Semana 7         |
| **Sobre sellado** para la 5.ª herramienta            | La métrica de modularidad era manipulable                                | Neutro           |
| **Modelo local acotado** (108 ejecuciones)           | Cumple el compromiso de la propuesta v5 y ataca la validez externa       | Semana 8         |
| **Runner en semanas 2–3**, no en la 7                | Era el mayor riesgo de cronograma                                        | Reordenamiento   |

**Nomenclatura:** `B0` integración directa · `B1` agente con MCP · `B2` multiagente en proceso · `B3` multiagente por A2A.

Totales: **40 tareas × 4 arquitecturas × 5 repeticiones = 800 ejecuciones**, más 108 de robustez.
Costo estimado en API: USD 40–150.

---

## Documentos de implementación del repositorio

Además del anexo, `docs/` contiene documentos que describen **cómo quedó construido este
repositorio** (monorepo Nx en TypeScript). Se mantienen a mano junto con el código.

| Documento                                                                            | Contenido                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`../apps/b0-directo/docs/ARQUITECTURA.md`](../apps/b0-directo/docs/ARQUITECTURA.md) | Arquitectura de B0: clases, herramientas, secuencias, instrumentación, defensa ante inyección y decisiones pendientes                                                                 |
| [`../apps/b1-mcp-agente/docs/ARQUITECTURA.md`](../apps/b1-mcp-agente/docs/ARQUITECTURA.md) | Arquitectura de B1: qué difiere de B0 (solo el puerto de capacidades por MCP), el servidor MCP, la instantánea de `tools/list`, la trazabilidad por cabecera y `_meta`, y sus decisiones pendientes |
| [`../apps/b0-directo/docs/HALLAZGOS-CORRIDA-2026-09-22.md`](../apps/b0-directo/docs/HALLAZGOS-CORRIDA-2026-09-22.md) | Por qué 23 de las 40 tareas no superan la compuerta automática en B0, con la evidencia de cada causa                                                        |
| [`arquitecturas.md`](arquitecturas.md)                                               | Topología de B0–B3 tal como está implementada, mapa de puertos y contrato de salud                                                                                                    |
| [`prompt-diffs.md`](prompt-diffs.md)                                                 | Diferencias de prompt entre condiciones: B0/B1 idénticos, B2/B3 idénticos entre sí, y el delta mecánico del orquestador y de los especialistas respecto del prompt base (docs/06, 4.7) |
| [`decisiones-tecnicas.md`](decisiones-tecnicas.md)                                   | Registro numerado de decisiones de ingeniería del repositorio                                                                                                                         |
| [`base-de-conocimiento.md`](base-de-conocimiento.md)                                 | Diagrama entidad-relación y [DBML](base-de-conocimiento.dbml) de la base de conocimiento, estados iniciales, las 39 políticas de la semilla y las huellas esperadas por variante      |
| [`sistema-de-metricas.md`](sistema-de-metricas.md)                                   | Cómo se validan las trazas, dónde se rechaza una ejecución, cómo se calculan e infieren las métricas y el contrato de `resultados.json` para el panel                                 |
| [`tasks/`](tasks/)                                                                   | Los 40 YAML del conjunto de evaluación y `_ESTRUCTURA.md` (generados; ver doc 10)                                                                                                     |
| [`historias-de-usuario-medicion.md`](historias-de-usuario-medicion.md)               | HU-MET-01 a HU-MET-14: contrato de datos de métricas, cálculo único y auditado, y panel de resultados. Complementa al doc 08 hasta que se incorporen a su fuente                      |
| [`historias-de-usuario-conocimiento.md`](historias-de-usuario-conocimiento.md)       | HU-KB-01 a HU-KB-10: grafo de conocimiento sobre PostgreSQL, datos semilla con distractores, búsqueda léxica determinista y relaciones de diagnóstico. Detalla la épica E2 del doc 08 |

## Cómo se organiza `docs/`

| Tipo                     | Ubicación                                    | Regla                                                                                                                                             |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Especificación del anexo | `NN-tema.md` (00–10)                         | Define **qué** se construye y se mide. Los marcados "Generado desde … no editar a mano" (08, 09, 10 y `tasks/`) se cambian en su fuente, no aquí. |
| Implementación           | `arquitecturas.md`, `decisiones-tecnicas.md` | Describe **cómo** está hecho en este repo. Se actualiza en el mismo cambio que el código.                                                         |
| Nuevos documentos        | kebab-case, enlazados desde este índice      | Ver la skill [`documentar`](../.claude/skills/documentar/SKILL.md).                                                                               |

Cuando la especificación y la implementación no coinciden, no se corrige una en silencio: se
registra la discrepancia (ver `AGENTS.md`, sección "Discrepancias conocidas") y se decide.

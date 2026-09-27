# UniHelp: informe final del banco de pruebas de integración de agentes

**Trabajo de grado · Universidad del Quindío · 27 de septiembre de 2026**

Este documento explica cómo está construido UniHelp por dentro y qué mostró el
experimento que compara cuatro formas de integrar agentes de IA: directa (B0),
por MCP (B1), multiagente en un proceso (B2) y multiagente distribuido por A2A
(B3). Toda cifra sale de un archivo de resultados del repositorio y se cita su
origen; las tablas numeradas `T1` a `T14` las genera
[`tablas.py`](tablas.py) a partir de esos archivos y se reproducen completas en
[`tablas.md`](tablas.md).

La base del análisis es el **consumo**: tokens, llamadas al modelo, latencia,
costo y transporte. La calidad de las respuestas según el **juez de IA** se
reporta completa, pero como **anotación** separada, con la explicación de por qué
da como da (decisión 59). Se declara en cada caso lo que se decidió después de
ver los datos.

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Qué es UniHelp y qué pregunta responde](#2-qué-es-unihelp-y-qué-pregunta-responde)
3. [Cómo está construido](#3-cómo-está-construido)
4. [Cómo funciona por dentro](#4-cómo-funciona-por-dentro)
5. [Las cuatro arquitecturas](#5-las-cuatro-arquitecturas)
6. [Los protocolos: MCP y A2A](#6-los-protocolos-mcp-y-a2a)
7. [El panel web](#7-el-panel-web)
8. [El sistema de medición](#8-el-sistema-de-medición)
9. [Campañas y modelos](#9-campañas-y-modelos)
10. [Resultados I · Consumo](#10-resultados-i--consumo-la-base-del-análisis)
11. [Resultados II · Conducta y seguridad](#11-resultados-ii--conducta-y-seguridad)
12. [Resultados III · Anotación del juez de calidad](#12-resultados-iii--anotación-del-juez-de-calidad)
13. [Resultados IV · Modularidad (M6)](#13-resultados-iv--modularidad-m6)
14. [Evaluación del sistema: la limitación de recuperación](#14-evaluación-del-sistema-la-limitación-de-recuperación)
15. [Veredicto por hipótesis](#15-veredicto-por-hipótesis)
16. [Decisiones y desviaciones del plan](#16-decisiones-y-desviaciones-del-plan)
17. [Limitaciones, amenazas a la validez y trabajo futuro](#17-limitaciones-amenazas-a-la-validez-y-trabajo-futuro)
18. [Apéndices](#18-apéndices)

---

## 1. Resumen ejecutivo

**Qué se construyó.** Un chat de triaje de incidentes universitarios que clasifica
la solicitud, cita la normativa, consulta el estado de cuatro servicios y propone
tickets que solo se crean con la confirmación explícita de la persona. La misma
funcionalidad existe cuatro veces, y lo único que cambia entre ellas es cómo se
integran los agentes. Todo lo demás (dominio, contratos, herramientas, base de
conocimiento en PostgreSQL, frontend Angular) se comparte, para que las
diferencias medidas se deban a la integración.

**Qué se midió.** 40 tareas (10 informativas, 10 de diagnóstico, 10 compuestas y
10 adversariales) en las cuatro arquitecturas, con tres repeticiones, en seis
modelos: gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-4.1-mini, Qwen2.5 7B local y
gemini-3.1-flash-lite (esta última interrumpida en 348 de 480 ejecuciones por
falta de saldo). Son 2 748 ejecuciones válidas en esas seis campañas, más 1
corrida inicial y 8 corridas históricas o parciales. El cuaderno de Python
calcula 41 de las 43 métricas del plan; M7.6 y M7.7 quedan sin datos. Todo lo
archivado costó **54,03 USD** a precio de lista
(`docs/resultados-2026-09-27-metricas-m2-m3-m5-y-costo.md:99`).

**Hallazgos principales.**

1. **MCP no cuesta consumo.** B1 − B0 no cambia los tokens, la latencia ni las
   llamadas al modelo en ningún modelo: todos los intervalos incluyen el cero
   (T5). Un salto MCP cuesta 13,1 ms en p50 sin modelo (T4), frente a segundos
   de modelo.
2. **El multiagente sí cuesta, y no mejora la efectividad.** B2 − B1 añade entre
   3 203 y 8 169 tokens por ejecución y entre 1,6 y 6,2 segundos de latencia, en
   los seis modelos y con intervalos que excluyen el cero (T5). En los modelos de
   pago el costo por ejecución se multiplica por 1,6 a 2,3 (T2). Con la compuerta automática no mejora la tasa de éxito en ningún modelo
   y la empeora en Qwen2.5 7B: −20,8 puntos [−33,3; −9,2] (T7).
3. **A2A cuesta poco sobre el multiagente en proceso.** B3 − B2 no cambia los
   tokens ni el costo; añade latencia medible solo en gpt-5.5 (+251 ms) y en
   flash-lite (+447 ms) (T5). El piso del salto A2A es de 15,2 ms (T4).
4. **La confirmación explícita funciona.** Cero escrituras no autorizadas en las
   2 748 ejecuciones y cero falsos bloqueos donde se pudo medir (T10). Las
   defensas mecánicas (rechazo sin token y filtro por rol) nunca se pusieron a
   prueba porque ningún agente intentó saltarlas.
5. **El juez es mucho más estricto que la compuerta.** La tasa de éxito cae de
   32–94 % con la compuerta a 2–51 % con el juez (T6). Cerca de la mitad de las
   reprobaciones se deben a puntos que el agente nunca recibió: la búsqueda
   devuelve un solo extracto por política (sección 14). El juez coincide con la
   revisión humana en el 92,6 % (gpt-5.5) y el 92,3 % (gpt-5.4); en los modelos
   pequeños el acuerdo no llega al 85 % y sus cifras son exploratorias (T11).
6. **Agregar una herramienta no fue más fácil con MCP.** En M6, B1 tocó menos
   código y llegó antes a verde que B0, pero exigió reiniciar dos servicios en
   lugar de uno (T13), porque el cliente MCP guarda la lista de herramientas y no
   reconecta cuando el servidor se reinicia.

**Veredicto por hipótesis** (sección 15; descriptivo donde n no alcanza):

| Hipótesis | Veredicto |
| --- | --- |
| H1 · MCP no es inferior y reduce el esfuerzo de cambio | **Parcial.** No inferior en efectividad con la compuerta en gpt-5.5, gpt-5.4 y flash-lite, sin costo de consumo en ningún modelo. No sostiene la reducción del esfuerzo de cambio (M6.3), salvo que el responsable decida no contar el reinicio por la lista guardada (pendiente, decisión 60). |
| H2 · El multiagente mejora las tareas compuestas | **No sostenida.** Ningún contraste B2 − B1 en compuestas excluye el cero (n = 10 tareas), y el costo casi se duplica. |
| H3 · A2A conserva la calidad con un sobrecosto acotado | **Sostenida en el sobrecosto** (tokens ≈ 0, latencia de 16 a 447 ms). La no inferioridad en efectividad se demuestra en 3 de 6 modelos; en los otros el intervalo es demasiado ancho. |
| H4 · La confirmación evita acciones no autorizadas sin bloquear las legítimas | **Sostenida**: 0 escrituras no autorizadas y 0 % de falso bloqueo. Las defensas mecánicas no se ejercitaron. |

---

## 2. Qué es UniHelp y qué pregunta responde

### 2.1 El problema

Una universidad recibe solicitudes de soporte sobre cuatro servicios: aula
virtual, correo institucional, autenticación y matrícula. UniHelp las atiende en
un chat. Para cada solicitud debe:

- **Clasificarla**: informativa, diagnóstico, compuesta, fuera de alcance o
  adversarial (`libs/herramientas/src/lib/objeto-final.ts:32-69`).
- **Citar la normativa aplicable** con código y versión, sin inventar cifras.
- **Consultar el estado del servicio** y deducir la prioridad con una tabla
  institucional determinista (`libs/tickets/src/dominio/reglas/tabla-prioridad.rules.ts:22-44`).
- **Proponer un ticket** que solo se crea si la persona lo confirma (HU-17).
- **Resistir contenido hostil** incrustado en políticas o comunicados (F-7).

UniHelp es un trabajo de grado y un **banco de pruebas**, no un producto (AGENTS.md
§1).

### 2.2 La regla de oro del experimento

La misma funcionalidad se construye cuatro veces cambiando solo la forma de
integrar los agentes:

| Arq. | Agentes | Integración | Apps |
| --- | --- | --- | --- |
| **B0** | uno | directa (llamada a método) | `b0-directo` |
| **B1** | uno | MCP | `b1-mcp-agente` + `mcp-server` |
| **B2** | tres | en el mismo proceso | `b2-multiagente-local` (+ `mcp-server` para las herramientas) |
| **B3** | tres | A2A, distribuido | `b3-a2a-orquestador`, `b3-a2a-conocimiento`, `b3-a2a-diagnostico` + `mcp-server` |

Lo que **no** es la variable se comparte: dominio, contratos REST, frontend, las
cinco herramientas, la base de conocimiento, el bucle del agente, el cliente del
modelo, los casetes, los límites y la instrumentación. Lo que **sí** es la
variable se implementa por separado. Así cada contraste aísla un solo factor:

| Contraste | Qué aísla |
| --- | --- |
| B1 − B0 | El transporte de las herramientas: llamada a método frente a MCP (decisión 41) |
| B2 − B1 | La coordinación multiagente: tres modelos frente a uno, ambos con herramientas por MCP (decisión 45) |
| B3 − B2 | El transporte entre agentes: en proceso frente a A2A (decisión 44) |

### 2.3 Las hipótesis

El plan de medición (`docs/09-plan-de-medicion.md` §14, líneas 815-845) plantea
cuatro hipótesis. El registro de métricas sigue esta numeración; `docs/05` usa
otra más antigua (AGENTS.md §9).

| Hipótesis | Enunciado | Cómo se decide en el plan |
| --- | --- | --- |
| **H1** | MCP no es inferior a la integración directa en efectividad, y reduce el esfuerzo de cambio | Límite inferior de B1 − B0 mayor que −0,07 (IC unilateral 95 %, bootstrap pareado por tarea); esfuerzo de cambio con M6 |
| **H2** | La descomposición en varios agentes mejora las tareas compuestas frente a un agente único | B2 frente a B1 en las 10 tareas compuestas (el plan pedía una logística de efectos mixtos) |
| **H3** | A2A conserva la calidad de la descomposición e introduce un sobrecosto medible y acotado | No inferioridad de B3 − B2 con margen 0,07; sobrecosto reportado sin umbral |
| **H4** | La confirmación explícita evita acciones no autorizadas sin bloquear casos legítimos | 0 escrituras no autorizadas y falso bloqueo de como máximo 5 % |

### 2.4 Alcance

El anexo técnico (`docs/00` a `docs/10`) declara fuera de alcance, entre otras
cosas, la autenticación, los sistemas institucionales reales, la búsqueda
vectorial, la interfaz gráfica y la comparación entre proveedores de modelos
(`docs/08-historias-de-usuario.md` §20). El repositorio se apartó en dos puntos,
ambos registrados: tiene un frontend completo (decisión 13) y compara modelos de
tres proveedores como factor (decisión 49). No hay búsqueda vectorial (RM-01).

---

## 3. Cómo está construido

### 3.1 Un monorepo Nx en TypeScript, con Python para medir

El anexo describía un backend en Java y agentes en Python. El repositorio es
**todo TypeScript** (NestJS en el backend, Angular en el frontend) en un monorepo
Nx, y usa Python solo para medir (AGENTS.md §9). El monorepo pone todas las
arquitecturas sobre la misma versión de framework, de modo que las diferencias
medidas no vengan de dependencias distintas (decisión 3).

<!-- diagrama: diag-01-monorepo -->
```mermaid
{{mermaid:01-monorepo}}
```

*Figura 1. Mapa del monorepo y sus dependencias principales. Fuente:
[`diagramas/01-monorepo.mmd`](diagramas/01-monorepo.mmd).*

### 3.2 Qué hay en cada carpeta

| Carpeta | Contenido |
| --- | --- |
| [`apps/b0-directo`](../../apps/b0-directo) … [`apps/b3-a2a-diagnostico`](../../apps/b3-a2a-diagnostico) | Las seis apps NestJS de las cuatro arquitecturas. Solo cablean módulos compartidos con su puerto (sección 5) |
| [`apps/mcp-server`](../../apps/mcp-server) | Servidor MCP de las cinco herramientas, usado por B1, B2 y B3 |
| [`apps/simulador-servicios`](../../apps/simulador-servicios) | Emula los cuatro sistemas universitarios leyendo la misma base; no participa del triaje |
| [`apps/consola-experimento`](../../apps/consola-experimento) | Lanza el ejecutor y el cuaderno desde el panel, uno a la vez, y sirve la revisión humana (decisiones 39 y 56) |
| [`apps/web`](../../apps/web) | Frontend Angular único: chat y panel del experimento |
| [`libs/agente-nucleo`](../../libs/agente-nucleo) | Bucle del agente, cliente del modelo, casetes, instrumentación y rutas del contrato |
| [`libs/capacidades`](../../libs/capacidades) | Lógica de las cinco herramientas, registro aditivo e invocador |
| [`libs/capacidades-mcp`](../../libs/capacidades-mcp) | Cliente MCP que cumple el puerto de capacidades, con rol opcional |
| [`libs/multiagente-nucleo`](../../libs/multiagente-nucleo) | Orquestador y especialistas compartidos por B2 y B3 |
| [`libs/herramientas`](../../libs/herramientas) | Contrato de las herramientas, prompt base, validador, saneador y ejecutor |
| [`libs/conocimiento`](../../libs/conocimiento) | Grafo de políticas en PostgreSQL, búsqueda léxica y huella de estado |
| [`libs/tickets`](../../libs/tickets) | Propuesta, confirmación con token, creación y auditoría |
| [`libs/contratos`](../../libs/contratos), [`libs/dominio`](../../libs/dominio) | DTOs, rutas y vocabulario, sin lógica ni dependencias de runtime |
| [`libs/trazas`](../../libs/trazas) | Validación AJV de trazas antes de persistir |
| [`experiment/`](../../experiment) | Ejecutor, cuaderno de métricas, juez, microbenchmark, M6 y resultados archivados |
| [`infra/`](../../infra) | Un Dockerfile por app, Compose con profiles `b0`–`b3` y el Modelfile de Ollama |

### 3.3 Reglas de límites entre módulos

Las reglas no negociables de AGENTS.md §4 se verifican de forma automática:

- **Una arquitectura nunca importa de otra, y una app nunca importa de otra app.**
  Lo comprueba `@nx/enforce-module-boundaries` con etiquetas `arq:b0` … `arq:b3`,
  `arq:compartido` y `arq:frontend`.
- **`libs/dominio` no tiene lógica de triaje** (decisión 8): compartir la lógica
  anularía el estudio.
- **Clean Architecture en `apps/web`**: `domain/` no importa Angular ni RxJS, y
  `application/` y `presentation/` nunca importan `infrastructure/`
  (`apps/web/eslint.config.mjs:30-72`).
- **El contrato manda**: las siete apps de triaje responden exactamente las rutas
  y DTOs de `libs/contratos`.

### 3.4 Por qué las librerías están compartidas

Las decisiones 41, 44 y 45 llevaron casi todo el código a librerías:

- **Decisión 41.** El núcleo del agente y las capacidades son librerías; cada
  arquitectura de agente único aporta solo la implementación del puerto
  `PuertoCapacidades`. B0 usa `CapacidadesLocales` y B1 usa `CapacidadesMcp`. Así
  la resta B1 − B0 mide solo el transporte.
- **Decisión 44.** B2 y B3 son el mismo sistema multiagente con modelo
  (`libs/multiagente-nucleo`). La única pieza distinta es `PuertoEspecialistas`:
  en proceso en B2 y por A2A en B3.
- **Decisión 45.** B2 alcanza las herramientas por MCP, igual que B3, para que
  B3 − B2 aísle limpiamente el transporte entre agentes.

El bucle de *function calling* es literalmente el mismo código en las cuatro
arquitecturas (`libs/agente-nucleo/src/lib/agente/bucle-agente.ts:43-58`).

### 3.5 El contrato único

`libs/contratos` fija lo que ve el frontend y el ejecutor
(`libs/contratos/src/lib/api.contrato.ts:10-56`):

| Método y ruta | Uso |
| --- | --- |
| `POST /api/conversaciones/mensajes` | Enviar un mensaje; crea la conversación si no existe |
| `GET /api/conversaciones`, `GET/DELETE /api/conversaciones/:id` | Listar, leer y borrar conversaciones |
| `POST /api/tickets/propuestas` | Leer la propuesta pendiente; no crea el ticket |
| `POST /api/tickets/propuestas/:id/confirmacion` | Confirmar; exige `confirmacionExplicita: true` |
| `POST /api/tickets/propuestas/:id/rechazo` | Rechazar |
| `GET /api/politicas/:codigo`, `GET /api/servicios/:area/estado` | Consultas de lectura |
| `POST /experimento/restablecer`, `GET /experimento/trazas/:traceId` | Rutas del ejecutor, solo en perfil experimento (decisión 32) |
| `GET /health` | Identidad de la arquitectura, fuera de `/api` (decisiones 6 y 7) |

Los errores tienen una sola forma y un código HTTP fijo: `validacion` 400,
`no-encontrado` 404, `conflicto` 409, `limite-turnos` 429, `interno` 500 y
`servicio-no-disponible` 503.

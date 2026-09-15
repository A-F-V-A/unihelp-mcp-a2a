# AGENTS.md — reglas para cualquier IA que trabaje en UniHelp

Este archivo es la **fuente unica de reglas** para asistentes de IA (Claude
Code, Codex, Cursor, Copilot, Gemini, etc.) y sirve igual para personas nuevas
en el proyecto. Si una herramienta tiene su propio archivo (`CLAUDE.md`,
`.cursor/rules`, ...), ese archivo debe **remitir aqui** y no repetir reglas.

Si algo de este documento contradice al codigo, manda el codigo: corrige el
documento en el mismo cambio.

---

## 1. Que es UniHelp (leer antes de tocar nada)

UniHelp es un sistema de **triaje de incidentes universitarios** (un chat que
clasifica la solicitud, cita politicas, consulta el estado de servicios y
propone tickets). Es un **trabajo de grado**, no un producto.

El repositorio es un **banco de pruebas experimental**: la misma funcionalidad
se construye **cuatro veces** cambiando solo _como se integran los agentes_:

| Arq.   | Agentes | Integracion       | Apps                                                                             |
| ------ | ------- | ----------------- | -------------------------------------------------------------------------------- |
| **B0** | uno     | directa           | `b0-directo`                                                                     |
| **B1** | uno     | MCP               | `b1-mcp-agente` + `mcp-server`                                                   |
| **B2** | varios  | en proceso        | `b2-multiagente-local`                                                           |
| **B3** | varios  | A2A (distribuido) | `b3-a2a-orquestador`, `b3-a2a-conocimiento`, `b3-a2a-diagnostico` + `mcp-server` |

**Regla de oro del experimento:** todo lo que NO es la variable medida
(dominio, contratos, frontend) se comparte; todo lo que SI es la variable (la
logica de triaje y la coordinacion de agentes) se implementa por separado en
cada arquitectura. Cualquier cambio que rompa esa simetria contamina las
mediciones. Ante la duda, pregunta antes de compartir o duplicar codigo.

Estado actual: frontend Angular completo contra un backend **simulado**;
backends NestJS con solo el endpoint `/health`. La base de conocimiento
(`libs/conocimiento`, PostgreSQL) funciona aislada con sus pruebas, pero ninguna
app la importa todavia. Aun no hay logica de triaje, MCP real ni A2A real.

El diseño completo del experimento esta especificado en `docs/00` a `docs/10`
(anexo tecnico del seminario): historias de usuario, contrato MCP, agentes A2A,
dataset de 40 tareas, runner, metricas y plan de 10 semanas. Hipotesis H1-H4,
funcionalidades F-1 a F-7 y requisitos RNF-01 a RNF-08 se definen ahi.

---

## 2. De donde sacar contexto (en este orden)

1. **Este archivo.**
2. [`README.md`](README.md) — como levantar cada arquitectura y el mapa general.
3. [`docs/README.md`](docs/README.md) — indice del anexo tecnico y de los
   documentos del repositorio.
4. [`docs/08-historias-de-usuario.md`](docs/08-historias-de-usuario.md) — que
   debe hacer el sistema (HU-01 a HU-45), criterios de aceptacion y **fuera de
   alcance**. Toda funcionalidad nace de una HU. Complementos del backlog:
   - Medicion y visualizacion (HU-MET-01 a HU-MET-14):
     [`docs/historias-de-usuario-medicion.md`](docs/historias-de-usuario-medicion.md).
   - Base de conocimiento, grafo sobre PostgreSQL con busqueda lexica
     (HU-KB-01 a HU-KB-10):
     [`docs/historias-de-usuario-conocimiento.md`](docs/historias-de-usuario-conocimiento.md).
5. [`docs/arquitecturas.md`](docs/arquitecturas.md) — topologia y puertos tal
   como estan implementados.
6. [`docs/decisiones-tecnicas.md`](docs/decisiones-tecnicas.md) — **por que**
   el repo esta armado asi. Antes de "mejorar" algo que parece raro, busca aqui:
   casi siempre es deliberado.
7. El `README.md` del proyecto que vas a tocar (`libs/*/README.md`, ...).
8. El codigo vecino: el mejor ejemplo de como escribir algo nuevo es un archivo
   del mismo tipo que ya exista (ver ejemplos canonicos en las guias).

Segun la tarea, lee ademas:

| Si vas a...                                                                          | Lee                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Tocar `apps/web` o crear una capacidad nueva                                         | [`.claude/skills/arquitectura-limpia/SKILL.md`](.claude/skills/arquitectura-limpia/SKILL.md)                                                |
| Cambiar un DTO, una ruta, un tipo o un catalogo                                      | [`.claude/skills/contratos-y-dominio/SKILL.md`](.claude/skills/contratos-y-dominio/SKILL.md) y `docs/01` (modelo de dominio, contrato REST) |
| Escribir comentarios, un README o algo en `docs/`                                    | [`.claude/skills/documentar/SKILL.md`](.claude/skills/documentar/SKILL.md)                                                                  |
| Implementar `mcp-server` o un agente B1                                              | `docs/02-servidor-mcp.md`                                                                                                                   |
| Implementar B2 o B3 (orquestador, especialistas)                                     | `docs/03-agentes-a2a.md` y `docs/01` (B2 y B3 deben ser identicos salvo transporte)                                                         |
| Trabajar en `experiment/` (runner, trazas, juez)                                     | `docs/04`, `docs/05`, `docs/09`, `docs/10`, `docs/tasks/_ESTRUCTURA.md` y las reglas RM-01 a RM-17                                          |
| Metricas, cuaderno de analisis o panel de resultados                                 | `docs/historias-de-usuario-medicion.md` (HU-MET-01 a HU-MET-14), `docs/09` y las reglas RM-01 a RM-17                                       |
| Base de conocimiento (esquema, semillas, busqueda de politicas, estado de servicios) | `docs/historias-de-usuario-conocimiento.md` (HU-KB-01 a HU-KB-10), skill `contratos-y-dominio` y reglas RM-01, RM-10, RM-17                 |
| Planear que construir y cuando                                                       | `docs/06-plan-10-semanas-detallado.md` y seccion 19 de `docs/08`                                                                            |
| Tocar Docker o puertos                                                               | `infra/docker/docker-compose.yml` y `docs/arquitecturas.md`                                                                                 |

### Que documento manda

| Pregunta                                                             | Autoridad                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Que** debe hacer el sistema, que se mide, que queda fuera          | Anexo `docs/00`-`docs/10` (sobre todo 08, 09, 10)                |
| **Como** esta hecho en este repo (stack, nombres, puertos, carpetas) | Codigo + `docs/decisiones-tecnicas.md` + `docs/arquitecturas.md` |
| Forma exacta de la API que consume el frontend                       | `libs/contratos`                                                 |

Si ambos niveles se contradicen y tu tarea depende de ello, **detente y
pregunta**; no elijas uno en silencio. Las contradicciones ya conocidas estan
en la seccion 9.

Las guias viven en `.claude/skills/` porque Claude Code las carga como skills,
pero son Markdown normal: cualquier IA o persona debe leerlas igual.

---

## 3. Que hay en cada carpeta

```text
apps/
  b0-directo/            NestJS  B0  tags: tipo:app, arq:b0
  b1-mcp-agente/         NestJS  B1  tags: tipo:app, arq:b1
  b2-multiagente-local/  NestJS  B2  tags: tipo:app, arq:b2
  b3-a2a-orquestador/    NestJS  B3  tags: tipo:app, arq:b3   (entrada de B3)
  b3-a2a-conocimiento/   NestJS  B3  tags: tipo:app, arq:b3   (especialista)
  b3-a2a-diagnostico/    NestJS  B3  tags: tipo:app, arq:b3   (especialista)
  mcp-server/            NestJS  B1 y B3  tags: tipo:app, arq:compartido
  web/                   Angular, frontend UNICO  tags: tipo:app, arq:frontend
libs/
  conocimiento/          @unihelp/conocimiento: grafo de politicas en PostgreSQL, busqueda
                         lexica determinista, restablecimiento con huella (solo backends)
  contratos/             @unihelp/contratos: DTOs y rutas de red (solo tipos)
  dominio/               @unihelp/dominio: vocabulario y catalogos (sin logica)
experiment/              Arnes de medicion (vacio a proposito)
  ejecutor/ juez/        Fuente del arnes (futuro)
  trazas/ resultados/    Artefactos de corridas: NO se versionan
infra/docker/            Un Dockerfile.<app> por app + compose con profiles b0..b3
docs/                    Documentacion (indice en docs/README.md)
  00-...10-*.md          Anexo tecnico: especificacion del experimento (08-10 generados)
  tasks/                 40 YAML del conjunto de evaluacion (generados, no editar a mano)
  arquitecturas.md       Implementacion real: topologia y puertos
  decisiones-tecnicas.md Registro de decisiones del repositorio
tools/git-hooks/         Hook commit-msg (valida HU y prohibe firma de IA), plantilla de commit
.claude/                 Configuracion y skills de Claude Code (guias para todos)
.mcp.json                Servidores MCP para asistentes (Playwright)
```

Dentro de cada app NestJS hoy solo existe `src/app/salud/` (identico en las
siete; lo unico que cambia es `identidad.ts`). Dentro de `apps/web/src/app/`:

| Carpeta           | Que contiene                                                             |
| ----------------- | ------------------------------------------------------------------------ |
| `domain/`         | Modelos, reglas puras, errores y puertos (interfaces). TS puro.          |
| `application/`    | Tokens DI de los puertos, casos de uso y stores (signals).               |
| `infrastructure/` | Repositorios `http/`, `mock/` y `browser/`, mappers, `provideDataLayer`. |
| `presentation/`   | Componentes: `chat/`, `settings/`, `shell/`, `shared/`.                  |
| `nucleo/`         | Arranque: configuracion en runtime y servicio de salud.                  |

---

## 4. Reglas no negociables

1. **Una arquitectura nunca importa de otra.** Solo de `arq:compartido`. Lo
   verifica `@nx/enforce-module-boundaries`; no desactives la regla.
2. **Una app nunca importa de otra app.** Lo compartido va a `libs/`.
3. **`libs/dominio` no tiene logica de triaje** (clasificar, enrutar,
   priorizar). Solo tipos, constantes y catalogos (decision 8).
4. **`libs/contratos` y `libs/dominio` no dependen de ningun framework** ni
   tienen dependencias de runtime: se usan desde NestJS y Angular.
5. **El contrato manda.** Las siete apps de backend deben responder exactamente
   las rutas y DTOs de `libs/contratos`. No se cambia un contrato para
   acomodar una sola arquitectura.
6. **Clean Architecture en `apps/web`**: `domain/` no importa Angular ni RxJS;
   `application/` y `presentation/` nunca importan `infrastructure/`. La
   eleccion simulado/real vive SOLO en `infrastructure/provide-data-layer.ts`.
7. **La simulacion nunca llega a produccion**: `USE_MOCK_BACKEND` es `false`
   en `environment.ts` (decision 14).
8. **Un ticket solo nace de una accion explicita del usuario** (HU-17). Nunca
   por inferencia sobre el texto.
9. **No se versionan** credenciales (`.env`), ni trazas o resultados del
   experimento.
10. **No se inventa contexto.** Las historias de usuario estan en
    `docs/08`; si una HU, decision o requisito no esta escrito, pregunta.
11. **Lo que `docs/08` declara fuera de alcance no se construye** sin indicar
    que historia obligatoria se retira a cambio.
12. **Los documentos generados no se editan a mano** (`docs/08`, `docs/09`,
    `docs/10`, `docs/tasks/*.yaml`): se cambian en su fuente.
13. **Datos solo sinteticos** (RNF-05): nada de nombres, correos o
    identificaciones reales en fixtures, seeds o tareas.

### Reglas del experimento y de la medicion (RM-01 a RM-17)

Protegen lo que las cifras del estudio significan. Se citan por codigo
(`RM-17`). Las decisiones D1-D9 estan en `docs/09-plan-de-medicion.md`
(seccion 12); las historias de medicion, en
`docs/historias-de-usuario-medicion.md`.

**Prohibiciones absolutas**

- **RM-01.** NUNCA implementar busqueda semantica, embeddings o similitud
  vectorial. La recuperacion es lexica y determinista por decision registrada
  (HU-08).
- **RM-02.** NUNCA calcular una metrica fuera del cuaderno de analisis en
  Python. El frontend y NestJS solo leen resultados ya calculados (HU-MET-04,
  HU-MET-09).
- **RM-03.** NUNCA usar 800 como tamaño de muestra para inferencia. Son 40
  tareas (HU-MET-05).
- **RM-04.** NUNCA introducir paralelismo dentro de una ejecucion (D1).
- **RM-05.** NUNCA calcular una duracion restando marcas de tiempo de procesos
  distintos. Se restan duraciones reportadas por cada receptor (D5).
- **RM-06.** NUNCA usar reloj de pared para medir duraciones. Siempre monotono
  (D6).
- **RM-07.** NUNCA habilitar cache de contexto en la corrida oficial (D2).

**Obligaciones**

- **RM-08.** Toda metrica declara su campo fuente en `metricas.yaml` antes de
  implementarse. Si no esta en el registro, no se implementa (HU-MET-02).
- **RM-09.** Toda operacion de escritura deja evento de auditoria con huella
  criptografica del cuerpo, nunca el cuerpo.
- **RM-10.** Toda consulta que devuelva resultados ordenados declara su
  criterio de desempate explicito. Nunca orden implicito de insercion.
- **RM-11.** Toda interaccion con la persona ocurre en español, incluidos
  errores y rechazos (RNF-07).
- **RM-12.** Un cambio que toque contratos actualiza esquemas e instantanea de
  contrato en el mismo commit.
- **RM-13.** Un cambio que toque el experimento ya congelado exige entrada en
  el registro de desviaciones.

**Distinciones que no se pueden borrar**

- **RM-14.** Umbral de calidad ≠ resultado abierto. Nunca mostrar
  aprobado/reprobado sobre un resultado abierto (HU-MET-03, HU-MET-10).
- **RM-15.** Fallo de infraestructura (se reejecuta y excluye) ≠ cualquier otro
  fallo (cuenta como fallo de la arquitectura) (HU-MET-06).
- **RM-16.** Compuerta automatica eliminatoria ≠ veredicto del juez. El juez
  solo puede quitar exito, nunca otorgarlo.

**Cuando tengas duda**

- **RM-17.** Si una decision afecta lo que las cifras significan, **no la
  tomes**: pregunta y dejala registrada como decision, con su razon y su
  consecuencia, al estilo de D1-D9 del plan de medicion. Esta es la regla mas
  importante de la lista: evita que un asistente "resuelva" una ambiguedad
  metodologica por su cuenta y el equipo se entere cuando ya no se puede
  recoger el dato.

---

## 5. Convenciones de codigo

**Idioma**

- Nombres de dominio en **español**: `Ticket`, `PropuestaTicket`,
  `consultarPolitica`, `AREAS_SERVICIO`.
- Sufijos y conceptos de framework en su idioma original: `Controller`,
  `Module`, `Repository`, `UseCase`, `Injectable`, `Dto`.
- Los componentes de `presentation/` usan nombres en ingles
  (`chat-header`, `ticket-created-card`) con prefijo de selector `app-`.
- Textos visibles al usuario: español con ortografia completa (tildes, ¿?).
- Comentarios y documentacion tecnica: español; la convencion vigente escribe
  sin tildes. Mantenla dentro de un mismo archivo.

**Archivos** (kebab-case, el sufijo dice el rol)

| Sufijo                                          | Rol                               | Donde                                   |
| ----------------------------------------------- | --------------------------------- | --------------------------------------- |
| `*.contrato.ts`                                 | DTOs/rutas de red                 | `libs/contratos/src/lib/`               |
| `*.ts` (sin sufijo)                             | vocabulario/catalogo              | `libs/dominio/src/lib/`                 |
| `*.repository.ts`/`*.port.ts`                   | puerto (interface)                | `web/.../domain/ports/`                 |
| `*.rules.ts`                                    | reglas puras                      | `web/.../domain/rules/`                 |
| `*.use-case.ts`                                 | caso de uso (`ejecutar()`)        | `web/.../application/use-cases/`        |
| `*.store.ts`                                    | estado con signals                | `web/.../application/state/`            |
| `*.mapper.ts`                                   | DTO -> modelo (`mapearX(dto)`)    | `web/.../infrastructure/mappers/`       |
| `http-*.repository.ts` / `mock-*.repository.ts` | adaptadores                       | `web/.../infrastructure/`               |
| `*.fixture.ts`                                  | datos simulados tipados           | `web/.../infrastructure/mock/fixtures/` |
| `*.spec.ts`                                     | prueba unitaria, junto al archivo | al lado del codigo                      |

**TypeScript**

- Estricto siempre. Nada de `any`; usa `unknown` y estrecha.
- Propiedades `readonly` en modelos y DTOs.
- Enumeraciones como `const X = [...] as const` + `type X = (typeof X)[number]`,
  no `enum`.
- `import type` para lo que solo es tipo (regla de lint).
- DTOs usan fechas `string` ISO 8601; modelos de dominio usan `Date`.
- Prettier: comillas simples, 100 columnas, coma final. Ejecuta `pnpm format`.

---

## 6. Comentarios, READMEs y docs (resumen)

Detalle y plantillas en [`documentar`](.claude/skills/documentar/SKILL.md).

- **Comenta el POR QUE, no el QUE.** Un mapper obvio no lleva comentarios; una
  regla de negocio o una restriccion no evidente, si.
- Todo export publico de `libs/` lleva JSDoc `/** */` de una linea minimo.
- Si el codigo implementa una historia de usuario, citala: `(HU-13)`,
  `(HU-FE-19)`.
- Si el codigo existe por una decision tecnica, citala: `(decision 14)`.
- Cada proyecto de `libs/` tiene `README.md` con la tabla de sus archivos.
  **Si agregas un archivo, actualizas la tabla en el mismo cambio.**
- Una decision de ingenieria nueva se registra en
  `docs/decisiones-tecnicas.md` con el siguiente numero.

---

## 7. Comandos

```bash
pnpm setup              # instala dependencias
pnpm dev:web            # frontend con backend simulado -> :4200
pnpm dev:b0             # (b1/b2/b3) backend en desarrollo
pnpm b0                 # (b1/b2/b3) arquitectura completa en Docker
pnpm down               # detiene Docker
pnpm nx lint <proyecto> # lint de un proyecto
pnpm nx test <proyecto> # tests de un proyecto
pnpm verify             # lint + test + build de todo (obligatorio antes de cerrar)
pnpm graph              # grafo de dependencias
pnpm conocimiento:db    # PostgreSQL de la base de conocimiento (Docker)
pnpm conocimiento:migrar && pnpm conocimiento:sembrar
pnpm conocimiento:test-integracion  # pruebas de libs/conocimiento contra PostgreSQL
```

---

## 8. Definicion de terminado

Un cambio esta terminado cuando:

1. `pnpm verify` pasa (o, como minimo, lint + test + build de los proyectos
   afectados y de todos los que consumen una lib modificada).
2. Tiene pruebas unitarias si agrega reglas, casos de uso, mappers o
   repositorios.
3. Si toca `apps/web`, `libs/contratos` o `libs/dominio`: **se valido en un
   navegador real** (Claude Code: MCP de Playwright, procedimiento en
   `CLAUDE.md`). Si no se pudo, se dice explicitamente.
4. READMEs, `docs/` y comentarios afectados estan actualizados.
5. El reporte final dice que se verifico y que no, sin exagerar.

### Commits

Reglas basadas en `docs/07` (seccion 5). Las verifica el hook
`tools/git-hooks/commit-msg`, que se activa solo con `pnpm install`; un commit
que no las cumple se rechaza.

1. **PROHIBIDO atribuir un commit o un PR a una IA.** Nada de
   `Co-Authored-By: Claude …`, `Generated with …`, `🤖`, "hecho con IA" ni
   ninguna firma equivalente, venga de la herramienta que venga. El autor del
   commit es la persona responsable del cambio. Si tu herramienta agrega esas
   lineas por defecto, desactivalo (Claude Code ya lo tiene desactivado en
   `.claude/settings.json`).
2. **Todo commit referencia la historia de usuario** que atiende
   (`HU-xx` de `docs/08-historias-de-usuario.md`, `HU-MET-xx` de
   `docs/historias-de-usuario-medicion.md` o `HU-KB-xx` de
   `docs/historias-de-usuario-conocimiento.md`), y **explica como se
   resolvio**.
3. Commits convencionales en español; un commit por cambio logico.

```text
tipo(alcance): resumen en presente, sin punto final

Historia: HU-13, HU-14
Resolucion: que problema planteaba la historia y como se resolvio: que se
cambio, en que capas o archivos, y por que se eligio esa solucion.
Pruebas: como se verifico (specs, pnpm verify, navegador).
```

| Campo         | Regla                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `tipo`        | `feat`, `fix`, `exp`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `chore`                         |
| `alcance`     | opcional: `web`, `contratos`, `dominio`, `b0`…`b3`, `mcp`, `infra`, `experiment`                         |
| `Historia:`   | obligatorio. Codigos que existan en `docs/08`. Si no aplica: `ninguna — motivo` (**nunca** en un `feat`) |
| `Resolucion:` | obligatorio. Minimo una frase concreta; referencia criterios de aceptacion de la HU cuando aplique       |
| `Pruebas:`    | recomendado                                                                                              |

Ejemplo:

```text
feat(web): pide confirmacion explicita antes de crear un ticket

Historia: HU-13, HU-17
Resolucion: la tarjeta de propuesta muestra servicio, prioridad y resumen, y
solo el boton "Crear ticket" invoca ConfirmarTicketUseCase. El contrato exige
confirmacionExplicita: true, asi que ningun texto del chat puede crear el
ticket (criterio 2 de HU-17).
Pruebas: confirmation-prompt.spec.ts y conversacion.store.spec.ts; validado
en navegador con backend simulado.
```

Probar un mensaje sin hacer commit:
`node tools/git-hooks/validar-mensaje-commit.mjs archivo.txt`.

**Ramas:** `feat/…`, `fix/…`, `exp/…`, `docs/…`. **PRs:** misma regla: la
descripcion lista las historias atendidas y como se resolvieron, sin firma de
IA. Si el cambio toca el experimento ya congelado, requiere entrada en el
registro de desviaciones. Una IA solo hace commit o push cuando el usuario lo
pide, y **nunca** usa `--no-verify` para saltarse el hook.

---

## 9. Discrepancias conocidas entre el anexo y el repositorio

El anexo (`docs/00`-`docs/10`) se escribio antes de montar este monorepo y en
varios puntos describe otra implementacion. **Ninguna esta resuelta todavia**;
hasta que se registre una decision, no las "arregles" por tu cuenta.

| Tema                   | Anexo dice                                                                                     | Repositorio tiene                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Stack                  | API Java 21 / Spring Boot + PostgreSQL; agentes, MCP y runner en Python (`docs/01`, `docs/07`) | Todo TypeScript: NestJS + Angular en Nx                                                             |
| Nombres de apps        | `baseline-direct`, `agent-mcp`, `multiagent-local`, `multiagent-a2a`, `unihelp-api`            | `b0-directo`, `b1-mcp-agente`, `b2-multiagente-local`, `b3-a2a-*`; no existe `unihelp-api`          |
| Puertos                | 8080-8084                                                                                      | 3000-3010 y 4200 (`docs/arquitecturas.md`)                                                          |
| B2 y MCP               | B2 accede a capacidades por el servidor MCP (`docs/01`)                                        | El profile `b2` no levanta `mcp-server` (`docs/arquitecturas.md`)                                   |
| Profiles de Compose    | `base`, `b1`, `b2` (= B3), `full`                                                              | `b0`, `b1`, `b2`, `b3`                                                                              |
| Interfaz grafica       | **Fuera de alcance** (`docs/08`, seccion 20)                                                   | Frontend Angular completo en `apps/web`                                                             |
| Arnes experimental     | `evaluation/` (runner, judge, tasks, schemas)                                                  | `experiment/` (ejecutor, juez, trazas, resultados); tareas en `docs/tasks/`                         |
| Registro de decisiones | `docs/adr/ADR-NNN` y `deviations.md`                                                           | `docs/decisiones-tecnicas.md` numerado                                                              |
| Codigos de HU          | `HU-01` a `HU-45`, `HU-MET-01` a `HU-MET-14` y `HU-KB-01` a `HU-KB-10` (documentos aparte)     | El codigo del frontend tambien cita `HU-FE-xx`, que no estan documentadas                           |
| Estados de servicio    | HU-KB-09: `operativo`, `degradado`, `mantenimiento`, `caído`                                   | `libs/dominio` `NIVELES_ESTADO_SERVICIO`: `operativo`, `degradado`, `interrumpido`, `mantenimiento` |
| Corpus de conocimiento | `docs/10`: 24 politicas, sin versiones historicas | `libs/conocimiento`: 39 politicas y 55 versiones (15 distractoras de HU-KB-04 y 3 adversariales redactadas; decision 18) |

Cuando una se resuelva: registrar la decision, actualizar el documento que
quede desactualizado y quitar la fila de esta tabla.

# Arquitectura de B0: agente único con integración directa

> Estado: **implementado** en su primera versión (19 de septiembre de 2026). El agente
> responde por las rutas de `libs/contratos` y el frontend lo usa con
> `pnpm dev:web:b0`. El conjunto de 40 tareas ya corre contra B0 con el ejecutor de
> `experiment/ejecutor/` (decisiones 31 y 32); **17 de 40 superan la compuerta
> automática** y las causas están en
> [`HALLAZGOS-CORRIDA-2026-09-22.md`](HALLAZGOS-CORRIDA-2026-09-22.md).
> Pendiente: correr en Docker. Las marcas **[a crear]** de este documento describen el diseño original;
> lo construido y sus diferencias están en [Estado de la implementación](#estado-de-la-implementación).
>
> **Desde el 23 de septiembre de 2026 el código que aquí se describe ya no vive en
> `apps/b0-directo/src/app/`**: el núcleo del agente se movió a
> [`libs/agente-nucleo`](../../../libs/agente-nucleo/README.md) y los adaptadores de las cinco
> herramientas a [`libs/capacidades`](../../../libs/capacidades/README.md), sin cambiar su
> comportamiento, para que B1 sea el mismo agente con otro transporte (decisión 41). Las rutas
> de archivo de las secciones 3 y 4 son las históricas; la tabla de
> [Estado de la implementación](#estado-de-la-implementación) dice dónde está cada clase hoy.
> Lo que B1 cambia está en [`apps/b1-mcp-agente/docs/ARQUITECTURA.md`](../../b1-mcp-agente/docs/ARQUITECTURA.md).

Este documento es la referencia técnica de B0 para quien va a implementar el agente: qué es,
qué historias cumple, qué clases tiene, qué contrato publican sus herramientas, cómo se
instrumenta y qué no hace. Está escrito para no tener que volver a interpretar el anexo del
seminario (`docs/00` a `docs/10`). Donde el anexo, el repositorio y el encargo de este
documento no coinciden, **no se elige**: la diferencia queda en la
[sección 13, Decisiones pendientes](#13-decisiones-pendientes), como exige RM-17.

## Cómo leer las marcas

| Marca         | Significa                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- |
| **[existe]**  | Está en el repositorio hoy, en la ruta indicada.                                             |
| **[a crear]** | Nombre propuesto por este documento. No existe todavía y puede cambiar al implementarse.     |
| **[DP-nn]**   | Depende de una decisión pendiente de la sección 13. Lo escrito es la propuesta, no un hecho. |

Fuentes que este documento no repite y que mandan sobre él:

| Tema                                           | Fuente                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Reglas del proyecto y RM-01 a RM-17            | [`AGENTS.md`](../../../AGENTS.md)                                                                                                      |
| Decisiones 1 a 22                              | [`docs/decisiones-tecnicas.md`](../../../docs/decisiones-tecnicas.md)                                                                  |
| Historias HU-01 a HU-45 y RNF-01 a RNF-08      | [`docs/08-historias-de-usuario.md`](../../../docs/08-historias-de-usuario.md)                                                          |
| Contrato de las herramientas (anexo)           | [`docs/02-servidor-mcp.md`](../../../docs/02-servidor-mcp.md)                                                                          |
| Métricas, decisiones D1 a D9 y estados finales | [`docs/09-plan-de-medicion.md`](../../../docs/09-plan-de-medicion.md), [`experiment/metricas.yaml`](../../../experiment/metricas.yaml) |
| Esquema de la traza                            | [`experiment/schemas/traza.schema.json`](../../../experiment/schemas/traza.schema.json)                                                |
| Contrato de red del frontend                   | [`libs/contratos`](../../../libs/contratos/README.md)                                                                                  |
| Base de conocimiento                           | [`libs/conocimiento`](../../../libs/conocimiento/README.md), [`docs/base-de-conocimiento.md`](../../../docs/base-de-conocimiento.md)   |
| Las 40 tareas                                  | [`docs/tasks/`](../../../docs/tasks/), [`_ESTRUCTURA.md`](../../../docs/tasks/_ESTRUCTURA.md)                                          |

---

## 1. Qué es B0

B0 es la **línea base** del experimento: un **agente único** que atiende la solicitud con
**function calling** sobre las herramientas del sistema, cuyas implementaciones viven **en el
mismo proceso** que el agente. No hay protocolo entre el agente y las capacidades: cuando el
modelo pide una herramienta, la invocación termina en una clase adaptadora local que llama a
los casos de uso compartidos (`CATALOGO_ARQUITECTURAS.B0` en
[`libs/dominio`](../../../libs/dominio/src/lib/arquitecturas.ts) **[existe]**;
[`docs/arquitecturas.md`](../../../docs/arquitecturas.md) **[existe]**).

Responde a la pregunta «¿cuál es el desempeño de referencia sin protocolos?» (docs/01 §1) y es
el sustraendo del contraste de H1: `P(B1) − P(B0)` (docs/09 §14; `inferencia.contrastes` de
`experiment/metricas.yaml` **[existe]**, par `[B1, B0]`).

### Frontera exacta con B1

**B0 sí usa function calling.** El modelo recibe la definición de cada herramienta, decide
cuál invocar, en qué orden y con qué argumentos, y recibe el resultado en el rol de herramienta
del protocolo de mensajes. Lo único que cambia en B1 es el camino que recorre esa invocación
después de que el modelo la emite:

```mermaid
flowchart LR
  subgraph b0["B0"]
    direction LR
    m0["El modelo decide herramienta y argumentos"] --> t0["TransporteHerramientasLocal<br/>llamada a un método del mismo proceso"] --> c0["Adaptador local<br/>casos de uso compartidos"]
  end
  subgraph b1["B1"]
    direction LR
    m1["El modelo decide herramienta y argumentos"] --> t1["Cliente MCP<br/>JSON-RPC sobre Streamable HTTP"] --> c1["mcp-server<br/>los mismos casos de uso compartidos"]
  end
```

| Aspecto                                   | B0                                                                                   | B1                                                            | ¿Puede diferir?                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Número de agentes                         | 1                                                                                    | 1                                                             | No                                                                             |
| Modelo, snapshot y parámetros de muestreo | Los de la configuración de la corrida                                                | Los mismos                                                    | No (RNF-01, RNF-08)                                                            |
| Prompt base                               | Prompt base compartido **[a crear]** (docs/06, actividad 3.2)                        | El mismo                                                      | No (RNF-01)                                                                    |
| Nombres y esquemas de las herramientas    | Los de la [sección 5](#5-las-herramientas)                                           | Los mismos, publicados por `tools/list`                       | No: si divergen, la comparación se invalida                                    |
| Descripción de las herramientas           | La de la sección 5                                                                   | La que publique `mcp-server`                                  | Es el único delta de prompt admitido, y se publica (RNF-01)                    |
| Quién decide qué herramienta invocar      | El modelo                                                                            | El modelo                                                     | No                                                                             |
| Bucle del agente, límites y saneamiento   | `BucleAgente`, `PresupuestoEjecucion`, saneador compartido                           | Equivalentes, con el mismo código compartido **[DP-07]**      | No                                                                             |
| Implementación de cada capacidad          | Casos de uso compartidos **[a crear, DP-07]** y `@unihelp/conocimiento` **[existe]** | Los mismos, invocados por `mcp-server`                        | No                                                                             |
| **Transporte de la invocación**           | Llamada a método en proceso                                                          | `tools/call` por JSON-RPC 2.0 sobre Streamable HTTP (docs/02) | **Sí: es la variable que mide H1**                                             |
| Descubrimiento de capacidades             | Lista fija, compilada en `RegistroCapacidades`                                       | `tools/list` con `listChanged` (HU-25, HU-27)                 | Sí, es parte del protocolo; se mide una sola vez, en la semana 8 (M6.1 a M6.5) |
| `timing.breakdown.transport_ms`           | Suma de `rtt − dur` de la llamada local; pequeña, pero se mide                       | Suma de `rtt − dur` de cada `tools/call`                      | Sí: es lo que se quiere observar (M4.2, D5)                                    |
| `a2a.mensajes_totales`                    | 0                                                                                    | 0                                                             | No: el esquema lo fija en cero para ambas (M4.5)                               |
| Confirmación antes de crear un ticket     | Turno adicional de la conversación                                                   | Turno adicional de la conversación                            | No (docs/01 F-4)                                                               |
| Garantía de escritura y auditoría         | Validación del token y registro de auditoría compartidos                             | Los mismos                                                    | No (HU-16, HU-31 criterio 3)                                                   |

### Por qué la equivalencia es un requisito y no una preferencia de diseño

H1 estima `P(B1) − P(B0)` y lo compara con un margen de no inferioridad de −0,07 fijado antes
de ver los datos (docs/09 §14). Ese número solo significa «lo que cuesta MCP» si B0 y B1
resuelven la tarea con la **misma estrategia** y difieren únicamente en el transporte. Cualquier
diferencia adicional entra en el mismo número y no hay forma de separarla después. Por eso B0
**no** clasifica con un árbol de decisión previo, **no** inyecta la base de conocimiento completa
en el prompt y **no** resuelve nada antes de consultar al modelo:

1. **Clasificación (HU-02, F-1).** En B0 y B1 la clasificación se infiere del comportamiento del
   agente, de las herramientas que invoca. Un preprocesador determinista tomaría esa decisión en
   lugar del modelo: M3.6 mediría al preprocesador y no al agente, y las herramientas invocadas
   dejarían de ser una observación del agente.
2. **Delta de prompt (RNF-01).** El delta admitido entre arquitecturas se limita a la
   descripción de las herramientas. Un preprocesador o un prompt con la base de conocimiento
   completa sería un delta muchísimo mayor.
3. **Métricas sobre `tool_calls[]`.** M2.1 a M2.5 se calculan sobre las llamadas a herramientas
   de la traza. Si B0 resolviera sin llamarlas, esas métricas quedarían vacías para B0. Lo mismo
   le pasaría a M3.1, que busca las cifras citadas en los extractos recuperados **en esa
   ejecución** (`tool_calls[].resultado`).
4. **Aislamiento del transporte (H1, M4.2).** Si B0 y B1 difieren en la estrategia de
   resolución, `B1 − B0` deja de aislar el costo de MCP, en efectividad y también en latencia y
   tokens (M4.1, M4.6).

---

## 2. Historias de usuario que responde

La columna «Componente» usa los nombres de la [sección 4](#4-catálogo-de-clases). Ninguno existe
todavía salvo los marcados **[existe]**.

### Historias de producto

| HU    | Qué exige concretamente del agente B0                                                                                             | Componente que la implementa                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| HU-01 | Aceptar texto libre de 10 a 2000 caracteres y responder siempre en español. Ante una entrada corta, pedir aclaración **[DP-13]**. | `ConversacionController`, `LONGITUD_SOLICITUD` **[existe]**                                        |
| HU-02 | Clasificar sin preprocesador: la clasificación sale del comportamiento del modelo **[DP-12]**.                                    | `BucleAgente`, `ExtractorObjetoFinal`                                                              |
| HU-03 | Ante un asunto fuera de los cuatro servicios, indicar el canal y no invocar herramientas de escritura.                            | Modelo y prompt base; la ausencia de escritura se verifica en la auditoría                         |
| HU-04 | Conservar el contexto hasta el límite de turnos y avisar explícitamente del corte, sin mezclar conversaciones.                    | `RepositorioConversaciones`, `PresupuestoEjecucion`                                                |
| HU-05 | Citar código y versión. Máximo tres políticas por relevancia, con posición del extracto.                                          | `AdaptadorBuscarPolitica` → `BuscarPoliticaUseCase` **[existe]**                                   |
| HU-06 | No inventar cifras, plazos ni direcciones: todo dato citado debe estar en un extracto recuperado en la ejecución.                 | Modelo; se verifica con M3.1 sobre `tool_calls[].resultado`                                        |
| HU-07 | Declarar la ausencia de una política aplicable, sin sustituirla por la más parecida.                                              | `BuscarPoliticaUseCase` **[existe]** (resultado `sin-resultados` con motivo)                       |
| HU-08 | Usar la búsqueda determinista compartida, sin reimplementarla.                                                                    | `@unihelp/conocimiento` **[existe]**, decisión 17                                                  |
| HU-09 | Consultar el estado del servicio antes de diagnosticar y distinguir el caso individual del incidente general.                     | `AdaptadorConsultarEstadoServicio` → `ConsultarComponentesDeServicioUseCase` **[existe]**          |
| HU-10 | Informar estado, componentes, alcance, referencia y ventana solo si está publicada.                                               | Ídem                                                                                               |
| HU-11 | La prioridad del ticket sale de la tabla institucional, no del criterio del modelo **[DP-02]**.                                   | `TablaPrioridad` **[a crear, DP-02]** usada por `ProponerTicketUseCase`                            |
| HU-12 | En mantenimiento, informar la ventana y no proponer ni crear ticket.                                                              | Modelo; lo verifica la compuerta automática con `esperado.ticket.debe_crearse`                     |
| HU-13 | Proponer antes de crear: resumen legible, sin efecto sobre el ticket, con los campos faltantes listados.                          | `AdaptadorProponerTicket` → `ProponerTicketUseCase` **[a crear]**                                  |
| HU-14 | Registrar la confirmación a partir del texto literal de la persona. Un texto ambiguo no confirma.                                 | `ConfirmarPropuestaUseCase` **[a crear, DP-01, DP-05]**                                            |
| HU-15 | Respetar la negativa: sin ticket y con la propuesta descartada.                                                                   | `ConfirmarPropuestaUseCase`, `ESTADOS_PROPUESTA_TICKET` **[existe]**                               |
| HU-16 | Ninguna creación sin token válido. El token de otra propuesta, o vencido, se rechaza y se audita.                                 | `CrearTicketUseCase` **[a crear]**: la garantía mecánica                                           |
| HU-17 | Devolver número y estado. Un reintento sobre la misma propuesta devuelve el ticket existente.                                     | `CrearTicketUseCase` (idempotente por `proposal_id`), `TicketDto` **[existe]**                     |
| HU-18 | Tratar el contenido recuperado como información: delimitarlo, etiquetarlo y advertir del contenido anómalo.                       | `SaneadorContenidoRecuperado`, `DetectorInstruccionesIncrustadas` **[a crear, DP-04, DP-07]**      |
| HU-19 | Rechazar la petición de saltar la confirmación, aunque se alegue autoridad o urgencia.                                            | Modelo (capa comportamental) y `CrearTicketUseCase` (garantía)                                     |
| HU-21 | No exponer datos de terceros. Los reportes solo entregan conteos.                                                                 | Modelo; herramienta de reporte solo con conteos si existe **[DP-01]**                              |
| HU-22 | Devolver un error tipado ante un argumento inválido y cortar al superar el máximo de llamadas.                                    | `ValidadorArgumentos`, `EjecutorCapacidad` **[a crear]** (`VALIDACION_ENTRADA`, `LIMITE_EXCEDIDO`) |
| HU-23 | Conteos por servicio, prioridad o estado, con rango de fechas.                                                                    | `ConsultarReporteTicketsUseCase` **[a crear, DP-01]**                                              |

### Historias de plataforma que aplican a B0

| HU                  | Qué exige concretamente del agente B0                                                                                   | Componente que la implementa                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| HU-27               | Agregar la herramienta sellada exige recompilar B0. Ese esfuerzo es un dato de M6.1 a M6.5, no un defecto.              | `RegistroCapacidades` (lista compilada)                                    |
| HU-30               | «En B0 y B1 el agente único emite el mismo objeto final» que el orquestador de B2 y B3 (docs/03 §4.3).                  | `ExtractorObjetoFinal` **[DP-12]**                                         |
| HU-31 (c.3)         | La confirmación como turno de conversación produce el mismo registro de auditoría que la transición A2A de B3.          | `ConfirmarPropuestaUseCase`, `RegistroAuditoria`                           |
| HU-33               | Propagar el `trace_id` recibido hasta cada evento de auditoría.                                                         | `ConversacionController`, `EjecutorCapacidad`, `RegistroAuditoria`         |
| HU-34               | Registrar los cuatro componentes de la latencia y el consumo de tokens. Sin tokens, la ejecución es inválida.           | `InstrumentadorTrazas`, `ClienteModelo`, `TransporteHerramientasLocal`     |
| HU-35               | Toda escritura deja evento de auditoría con la huella del cuerpo, nunca el cuerpo. Los eventos no se modifican (RM-09). | `RegistroAuditoria` **[a crear]**, esquema `auditoria` de solo agregar     |
| HU-36               | B0 no restablece nada: registra la huella que devolvió el restablecimiento que hizo el ejecutor.                        | `InstrumentadorTrazas` (campo `provenance.state_hash_inicial`) **[DP-09]** |
| HU-38               | La traza se valida antes de persistirse. Una inválida se aparta y la ejecución se marca `esquema_invalido`.             | `PersistidorTrazas` **[existe]**, invocado según **[DP-09]**               |
| HU-39               | Grabar y reproducir las llamadas al modelo. En reproducción, una petición sin grabación produce un error explícito.     | `CaseteModelo` **[DP-16]**                                                 |
| HU-43               | La herramienta sellada se implementa en B0 cronometrada y por una sola persona.                                         | Todo B0: es el objeto medido                                               |
| HU-MET-01           | La traza trae todos los campos obligatorios del esquema, incluido el consumo de tokens.                                 | `InstrumentadorTrazas`, `ValidadorTrazas` **[existe]**                     |
| HU-MET-07           | Un residuo de orquestación negativo invalida la ejecución.                                                              | `InstrumentadorTrazas` **[DP-10]**                                         |
| HU-KB-01 a HU-KB-10 | Las atiende `libs/conocimiento`. B0 las consume sin reimplementar nada.                                                 | `@unihelp/conocimiento` **[existe]**                                       |

### Historias que NO aplican a B0

| HU                              | Por qué no aplica                                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HU-20                           | Separación de privilegios entre agentes: es de B2 y B3. B0 tiene un solo agente con acceso a todo. M5.6 se declara «no aplica» en B0, nunca se reporta como cero.                        |
| HU-25, HU-26                    | Publicación del contrato y anotaciones por MCP: son de B1, B2 y B3. B0 conserva los mismos esquemas y anotaciones como dato en `RegistroCapacidades`, para que el contrato sea uno solo. |
| HU-28                           | Recursos y plantillas de prompt de MCP.                                                                                                                                                  |
| HU-29, HU-31 (c.1 y c.2), HU-32 | Agent Cards, estado `input-required` y caída de un especialista: son de B3.                                                                                                              |
| HU-24, HU-37                    | Detector de contaminación y matriz completa: las cumple el ejecutor **[a crear]**, no el agente.                                                                                         |
| HU-40 a HU-42                   | Compuerta automática, juez y calificación humana: evalúan a B0, no las implementa B0.                                                                                                    |
| HU-44, HU-45                    | Réplica y cuaderno de análisis. B0 solo aporta el modo de reproducción (HU-39).                                                                                                          |

---

## 3. Diagrama de componentes

Los nodos en **rojo** sostienen la **garantía mecánica**: sin token válido no hay escritura y
todo intento queda auditado. Los nodos en **naranja con borde punteado** son controles de código
que acotan el comportamiento del modelo, pero no lo garantizan (ver
[sección 9](#9-defensa-ante-inyección-de-prompt)).

PostgreSQL tiene dos zonas. La **zona restablecible** se borra y se repuebla antes de cada
ejecución (HU-36, RNF-03). La **zona de solo agregar** guarda la auditoría: nunca se restablece
ni se modifica (HU-35), porque es la fuente independiente contra la que se verifican las
escrituras no autorizadas (M5.1). El comentario de
[`esquema.ts`](../../../libs/conocimiento/src/infraestructura/esquema.ts) **[existe]** ya
anticipa que tickets y auditoría vivirán en esquemas propios.

```mermaid
flowchart TB
  ejecutor["Ejecutor del experimento<br/>experiment/ejecutor [a crear]"]
  web["Frontend apps/web [existe]"]
  proveedor["Proveedor del modelo<br/>externo [DP-18]"]
  runs[/"runs/corrida/trazas.jsonl y cuarentena/"/]

  subgraph app["apps/b0-directo"]
    direction TB
    salud["SaludModule [existe]"]
    ctrl["ConversacionController [a crear]"]
    uc["AtenderTurnoUseCase [a crear]"]
    repo["RepositorioConversaciones [a crear]"]
    bucle["BucleAgente [a crear]"]
    pres["PresupuestoEjecucion [a crear]"]
    extr["ExtractorObjetoFinal [a crear]"]
    ens["EnsambladorRespuesta [a crear]"]
    cli["ClienteModelo [a crear, DP-16]"]
    cas["CaseteModelo [a crear, DP-16]"]
    reg["RegistroCapacidades [a crear]"]
    trans["TransporteHerramientasLocal [a crear]<br/>único componente que B1 reemplaza"]
    subgraph adapt["Adaptadores locales [a crear]"]
      a1["AdaptadorBuscarPolitica"]
      a2["AdaptadorConsultarEstadoServicio"]
      a3["AdaptadorProponerTicket"]
      a4["Adaptador de la quinta herramienta [DP-01]"]
      a5["AdaptadorCrearTicketSimulado"]
    end
    inst["InstrumentadorTrazas [a crear]"]
    reloj["RelojMonotono [a crear]"]
  end

  subgraph libs["Librerías compartidas"]
    contratos["@unihelp/contratos [existe]"]
    dominio["@unihelp/dominio [existe]"]
    conoc["@unihelp/conocimiento [existe]"]
    trazas["@unihelp/trazas [existe]<br/>ValidadorTrazas y PersistidorTrazas"]
    subgraph herr["@unihelp/herramientas [a crear, DP-07]"]
      ejec["EjecutorCapacidad"]
      val["ValidadorArgumentos"]
      san["SaneadorContenidoRecuperado"]
      det["DetectorInstruccionesIncrustadas"]
    end
    subgraph tick["@unihelp/tickets [a crear, DP-07]"]
      prop["ProponerTicketUseCase"]
      conf["ConfirmarPropuestaUseCase"]
      crear["CrearTicketUseCase<br/>valida el token"]
      rep["ConsultarReporteTicketsUseCase [DP-01]"]
      prio["TablaPrioridad [DP-02]"]
      aud["RegistroAuditoria"]
    end
  end

  subgraph pg["PostgreSQL 16"]
    subgraph resta["Zona restablecible: entra en el reset"]
      esqc[("esquema conocimiento [existe]")]
      esqt[("esquema tickets [a crear]")]
    end
    subgraph solo["Zona de solo agregar: NO se restablece"]
      esqa[("esquema auditoria [a crear]")]
    end
  end

  ejecutor -->|"HTTP con X-Trace-Id"| ctrl
  web -->|HTTP| ctrl
  ctrl --> uc
  ctrl -.-> contratos
  uc --> repo
  uc --> bucle
  uc --> ens
  uc --> inst
  bucle --> pres
  bucle --> cli
  bucle --> reg
  bucle --> trans
  bucle --> extr
  cli --> cas
  cli -->|HTTPS| proveedor
  trans --> adapt
  adapt --> ejec
  ejec --> val
  a1 --> conoc
  a2 --> conoc
  a1 --> san
  a2 --> san
  san --> det
  a3 --> prop
  a4 --> conf
  a4 -.-> rep
  a5 --> crear
  prop --> prio
  prio -.-> dominio
  conf --> aud
  crear --> aud
  ejec --> aud
  conoc --> esqc
  prop --> esqt
  conf --> esqt
  crear --> esqt
  rep --> esqt
  aud --> esqa
  inst --> reloj
  trans --> reloj
  cli --> reloj
  inst --> trazas
  trazas --> runs
  ejecutor -.->|"restablece y recibe la huella"| conoc
  ejecutor -.->|"lee la auditoría por trace_id [DP-09]"| esqa

  classDef garantia fill:#fdecea,stroke:#c0392b,stroke-width:3px,color:#000
  classDef control fill:#fff4e5,stroke:#e67e22,stroke-width:2px,stroke-dasharray:5 3,color:#000
  class conf,crear,aud,esqa garantia
  class san,det,val,ejec,pres control
```

---

## 4. Catálogo de clases

Una ficha por clase. La regla es una sola responsabilidad: si al describirla aparece una «y»,
se divide. Las rutas son relativas a `apps/b0-directo/src/app/` salvo que digan otra cosa.

Hay dos grupos:

- **Clases de B0.** Son la parte de la variable que el experimento mide y no se comparten
  (regla de oro de `AGENTS.md` §1).
- **Clases compartidas que B0 consume.** Tienen que ser el **mismo código** en B0 y en
  `mcp-server`. Si B0 validara, saneara o registrara de otra forma que B1, la diferencia entre
  ambas dejaría de ser el transporte. Dónde viven está pendiente **[DP-07]**.

### 4.1 Clases de B0

#### `ConversacionController` [a crear]

| Campo           | Contenido                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `conversacion/conversacion.controller.ts`                                                                                                    |
| Responsabilidad | Traducir las rutas de conversación de `RUTAS_API` a llamadas del caso de uso, y sus resultados o errores a los DTO del contrato.             |
| Recibe          | `EnviarMensajeDto` en `POST /api/conversaciones/mensajes` y la cabecera `X-Trace-Id`. Además `GET` y `DELETE` de conversaciones e historial. |
| Devuelve        | `RespuestaMensajeDto`, `HistorialConversacionDto`, `ResumenConversacionDto[]` o `ErrorApiDto` con el código de `CODIGOS_ERROR_API`.          |
| Depende de      | `AtenderTurnoUseCase`, `RepositorioConversaciones`, `@unihelp/contratos` **[existe]**                                                        |
| Sostiene        | HU-01, HU-33 (entrada del `trace_id`), RM-11 (errores en español), regla 5 de `AGENTS.md` (responde exactamente el contrato).                |

#### `AtenderTurnoUseCase` [a crear]

| Campo           | Contenido                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Archivo         | `conversacion/atender-turno.use-case.ts`                                                                                                                     |
| Responsabilidad | Coordinar un turno de la persona, de principio a fin.                                                                                                        |
| Recibe          | `conversacionId`, texto del turno y `trace_id`.                                                                                                              |
| Devuelve        | El mensaje del asistente ya ensamblado, los turnos consumidos y la acción sugerida.                                                                          |
| Depende de      | `RepositorioConversaciones`, `BucleAgente`, `EnsambladorRespuesta`, `InstrumentadorTrazas`, y el registro de turnos de `@unihelp/tickets` **[DP-05]**.       |
| Sostiene        | HU-04. Marca el inicio y el fin de cada turno para `timing.total_ms` (M4.1). Registra el turno real de la persona antes de que el modelo lo vea **[DP-05]**. |

#### `RepositorioConversaciones` [a crear]

| Campo           | Contenido                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Archivo         | `conversacion/repositorio-conversaciones.ts`                                                                 |
| Responsabilidad | Guardar y devolver el historial de mensajes de cada conversación, aislado de las demás.                      |
| Recibe          | `conversacionId` y mensajes en el formato del protocolo del modelo, incluidos los de rol de herramienta.     |
| Devuelve        | El historial en orden cronológico.                                                                           |
| Depende de      | Nada externo. Su persistencia (memoria del proceso o PostgreSQL) no está decidida; no afecta a las métricas. |
| Sostiene        | HU-04 (contexto de varios turnos, sin filtrarse entre solicitudes), RNF-03.                                  |

#### `BucleAgente` [a crear]

| Campo           | Contenido                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `agente/bucle-agente.ts`                                                                                                                                                                              |
| Responsabilidad | Alternar petición al modelo e invocación de herramientas, una a la vez, hasta que el modelo entrega su respuesta o se alcanza un corte.                                                               |
| Recibe          | Historial de la conversación y `trace_id`.                                                                                                                                                            |
| Devuelve        | Texto final, objeto final (si el modelo lo emitió), mensajes nuevos para el historial y motivo de terminación (`respuesta`, `timeout`, `limite_herramientas`, límite de turnos **[DP-08]**).          |
| Depende de      | `ClienteModelo`, `RegistroCapacidades`, `TransporteHerramientasLocal`, `PresupuestoEjecucion`, `ExtractorObjetoFinal`, `InstrumentadorTrazas`                                                         |
| Sostiene        | HU-02 (el modelo elige herramientas), D1 (sin paralelismo: si el modelo pide varias herramientas en una respuesta, se ejecutan en secuencia y en el orden emitido), M2.4 (`seq` en orden de emisión). |
| No hace         | No clasifica, no valida argumentos, no sanea contenido y no decide prioridades. Todo eso ocurre del lado del receptor, igual que en B1.                                                               |

#### `PresupuestoEjecucion` [a crear]

| Campo           | Contenido                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `agente/presupuesto-ejecucion.ts`                                                                                                                                                             |
| Responsabilidad | Decidir si queda presupuesto de tiempo y de turnos antes de cada petición al modelo.                                                                                                          |
| Recibe          | Tiempo de procesamiento acumulado (monótono, sin la espera de confirmación) y turnos de agente consumidos.                                                                                    |
| Devuelve        | `continuar`, `timeout` o `limite_turnos` **[DP-08]**, y el tiempo restante para cortar una petición al modelo en curso.                                                                       |
| Depende de      | `RelojMonotono`, configuración de límites ([sección 11](#11-configuración-y-límites)).                                                                                                        |
| Sostiene        | RNF-04 (120 s y 8 turnos de agente), HU-04 (el corte se informa, no es silencioso). El tercer límite, 20 llamadas, lo aplica el receptor (`EjecutorCapacidad`), igual que en B1 (docs/02 §5). |

#### `ClienteModelo` [a crear, DP-16]

| Campo           | Contenido                                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `modelo/cliente-modelo.ts`                                                                                                                                                                           |
| Responsabilidad | Hacer UNA petición al proveedor y devolver la respuesta junto con su consumo y su tiempo de ida y vuelta.                                                                                            |
| Recibe          | Prompt base, definiciones de herramientas de `RegistroCapacidades`, historial y parámetros de muestreo.                                                                                              |
| Devuelve        | Mensaje del modelo (texto o pedidos de herramienta), `input_tokens`, `output_tokens` y `cached_input_tokens` tal como los reporta el proveedor, y `rttMs`.                                           |
| Depende de      | `CaseteModelo`, `RelojMonotono`, proveedor externo **[DP-18]**.                                                                                                                                      |
| Sostiene        | M4.2 (`llm_ms` se mide en el cliente que emite la petición), M4.4, M4.6, D2 (nunca pide caché de contexto; siempre registra `cached_input_tokens`), RNF-08 (usa el identificador exacto del modelo). |

#### `CaseteModelo` [a crear, DP-16]

| Campo           | Contenido                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `modelo/casete-modelo.ts`                                                                                                                                               |
| Responsabilidad | Grabar o reproducir pares petición-respuesta según el modo de ejecución.                                                                                                |
| Recibe          | Petición canonicalizada. La clave es la de docs/05 §4: modelo, mensajes, nombres de herramientas ordenados y temperatura.                                               |
| Devuelve        | La respuesta grabada (`replay`), la respuesta real ya guardada (`record`) o la respuesta real sin guardar (`live`).                                                     |
| Depende de      | Directorio de casetes.                                                                                                                                                  |
| Sostiene        | HU-39, M7.3, HU-44. En `replay`, una clave ausente es un error explícito, nunca una llamada silenciosa. Ver **[DP-04]**: el marcador de delimitación entra en la clave. |

#### `ExtractorObjetoFinal` [a crear]

| Campo           | Contenido                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `agente/extractor-objeto-final.ts`                                                                                                                                     |
| Responsabilidad | Separar la respuesta final del modelo en texto para la persona y objeto final estructurado, validando la forma del objeto.                                             |
| Recibe          | El último mensaje del modelo.                                                                                                                                          |
| Devuelve        | `final_answer` (texto) y `final_json` (el objeto de docs/03 §4.3), o `null` si el objeto falta o no valida. Una falta no es `error_agente`: se registra en `errors[]`. |
| Depende de      | Esquema del objeto final **[a crear]** (docs/06, actividad 3.2: «política de formato del JSON final»).                                                                 |
| Sostiene        | HU-30, M3.5 (`outcome.final_json.diagnostico.prioridad`), M3.6 (`outcome.final_json.clasificacion`) **[DP-12]**.                                                       |

#### `EnsambladorRespuesta` [a crear]

| Campo           | Contenido                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `agente/ensamblador-respuesta.ts`                                                                                                                                       |
| Responsabilidad | Convertir el texto final y los resultados de herramienta de un turno en los bloques de `MensajeAsistenteDto`.                                                           |
| Recibe          | Texto final, objeto final y resultados estructurados (antes de sanear) de las herramientas del turno.                                                                   |
| Devuelve        | `BloqueRespuestaDto[]` (`texto`, `politicas`, `estado-servicio`, `aviso-mantenimiento`, `fuera-de-alcance`, `propuesta-ticket`, `ticket-creado`) y `AccionSugeridaDto`. |
| Depende de      | `@unihelp/contratos` **[existe]**, `MAXIMO_POLITICAS_POR_RESPUESTA` de `@unihelp/dominio` **[existe]**.                                                                 |
| Sostiene        | Contrato de red del frontend (decisión 13). No interviene en las métricas: solo da forma a lo que el modelo y las herramientas ya produjeron.                           |

#### `RegistroCapacidades` [a crear]

| Campo           | Contenido                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `herramientas/registro-capacidades.ts`                                                                                           |
| Responsabilidad | Mantener la lista fija de herramientas: nombre, descripción, esquemas, anotaciones y adaptador de cada una.                      |
| Recibe          | Nada en tiempo de ejecución: se construye al arrancar a partir de los esquemas compartidos **[DP-07]**.                          |
| Devuelve        | Las definiciones de herramienta que se envían al modelo y el adaptador que corresponde a un nombre.                              |
| Depende de      | Esquemas de herramientas **[a crear, DP-07]**, los cinco adaptadores.                                                            |
| Sostiene        | RNF-01 (mismas definiciones que publica B1), M6.1 a M6.5 (agregar una herramienta en B0 obliga a tocar esta lista y recompilar). |

#### `TransporteHerramientasLocal` [a crear]

| Campo           | Contenido                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `herramientas/transporte-herramientas-local.ts`                                                                                                                            |
| Responsabilidad | Entregar una invocación al adaptador correspondiente y medir su tiempo de ida y vuelta. Es el equivalente exacto del cliente MCP de B1.                                    |
| Recibe          | Nombre de la herramienta, argumentos tal como los emitió el modelo y `trace_id`.                                                                                           |
| Devuelve        | El resultado del adaptador (con su `dur` reportada) y `rttMs`.                                                                                                             |
| Depende de      | `RegistroCapacidades`, `RelojMonotono`.                                                                                                                                    |
| Sostiene        | M4.2 y D5: `transport_ms += rtt − dur`. En B0 la resta es pequeña, pero **se mide igual**; nunca se fija en cero por definición. Es la única clase de B0 que B1 reemplaza. |

#### Adaptadores locales [a crear]

Cinco clases con la misma forma, una por herramienta, en
`herramientas/adaptadores/<nombre>.adaptador.ts`:

| Campo           | Contenido                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Responsabilidad | Traducir los argumentos de UNA herramienta a la llamada de su caso de uso compartido, y el resultado del caso de uso al esquema de salida de la herramienta. |
| Recibe          | Argumentos ya validados (la validación ocurre en `EjecutorCapacidad`, antes de llegar aquí) y `trace_id`.                                                    |
| Devuelve        | La salida de la herramienta según la [sección 5](#5-las-herramientas), o un error tipado de docs/02 §5.                                                      |
| Depende de      | `EjecutorCapacidad` (que lo envuelve y mide su duración), el caso de uso compartido y, en las de lectura, `SaneadorContenidoRecuperado`.                     |
| Sostiene        | La historia de su herramienta (sección 5). Hacen el mismo trabajo que los manejadores de `mcp-server` **[DP-07]**.                                           |

| Adaptador                                                                              | Caso de uso compartido                                                       |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `AdaptadorBuscarPolitica`                                                              | `BuscarPoliticaUseCase` **[existe]**                                         |
| `AdaptadorConsultarEstadoServicio`                                                     | `ConsultarComponentesDeServicioUseCase` **[existe]**                         |
| `AdaptadorProponerTicket`                                                              | `ProponerTicketUseCase` **[a crear]**                                        |
| `AdaptadorCrearTicketSimulado`                                                         | `CrearTicketUseCase` **[a crear]**                                           |
| Quinta: `AdaptadorConfirmarPropuesta` o `AdaptadorConsultarReporteTickets` **[DP-01]** | `ConfirmarPropuestaUseCase` o `ConsultarReporteTicketsUseCase` **[a crear]** |

#### `InstrumentadorTrazas` [a crear]

| Campo           | Contenido                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `trazas/instrumentador-trazas.ts`                                                                                                                                                                   |
| Responsabilidad | Acumular las mediciones de una ejecución y armar con ellas la traza candidata.                                                                                                                      |
| Recibe          | Inicio y fin de cada turno, `rtt` y consumo de cada petición al modelo, `rtt` y `dur` de cada herramienta, cada `tool_call`, el resultado final y los datos de identidad y procedencia **[DP-09]**. |
| Devuelve        | Un objeto candidato a `TrazaEjecucion`, que entrega a `PersistidorTrazas.persistir` **[existe]**.                                                                                                   |
| Depende de      | `RelojMonotono`, `@unihelp/trazas` **[existe]**.                                                                                                                                                    |
| Sostiene        | HU-34, HU-MET-01, HU-MET-07, M4.1, M4.2, M4.4, M4.6, M7.1. Reporta el residuo **sin corregirlo**: un residuo negativo no se lleva a cero **[DP-10]**. No calcula ninguna métrica (RM-02).           |

#### `RelojMonotono` [a crear]

| Campo           | Contenido                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo         | `trazas/reloj-monotono.ts`                                                                                                              |
| Responsabilidad | Dar instantes monótonos para medir duraciones.                                                                                          |
| Recibe          | Nada.                                                                                                                                   |
| Devuelve        | Instantes monótonos en milisegundos con decimales (`process.hrtime.bigint()`).                                                          |
| Depende de      | Nada.                                                                                                                                   |
| Sostiene        | D6, RM-06. La hora de pared para `timing.started_at` y `ended_at` se lee aparte y solo sirve para ordenar y auditar, nunca para restar. |

### 4.2 Clases compartidas que B0 consume

Todas son **[a crear]** y su ubicación depende de **[DP-07]**. Los nombres de librería
`@unihelp/herramientas` y `@unihelp/tickets` son propuestas.

#### `EjecutorCapacidad` [a crear, DP-07]

| Campo           | Contenido                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsabilidad | Envolver la ejecución de UNA capacidad del lado del receptor: validar los argumentos, contar la llamada contra el límite, medir la duración del manejador y auditar la invocación.              |
| Recibe          | Nombre, argumentos crudos, `trace_id`, actor (`b0-agent`, docs/01 §4.6) y el manejador (adaptador en B0, manejador MCP en B1).                                                                  |
| Devuelve        | `{ resultado, dur }` o un error tipado con `dur`.                                                                                                                                               |
| Depende de      | `ValidadorArgumentos`, `RegistroAuditoria`, `RelojMonotono`.                                                                                                                                    |
| Sostiene        | M4.2 (`tool_exec_ms` desde la entrada al manejador hasta su salida, medido igual en B0 y B1), HU-22 y docs/02 §5 (`LIMITE_EXCEDIDO` en la llamada 21), HU-33 (evento de auditoría por llamada). |

> Esta ficha tiene cuatro verbos, pero es una sola responsabilidad: ser la puerta de entrada
> del receptor. Si se prefiere dividirla, las piezas son `ValidadorArgumentos`,
> `ContadorLlamadas` y `RegistroAuditoria`, y `EjecutorCapacidad` queda solo como la que las
> encadena y mide.

#### `ValidadorArgumentos` [a crear, DP-07]

| Campo           | Contenido                                                                             |
| --------------- | ------------------------------------------------------------------------------------- |
| Responsabilidad | Validar argumentos contra el esquema de entrada de la herramienta.                    |
| Recibe          | Nombre y argumentos.                                                                  |
| Devuelve        | `valido` o `VALIDACION_ENTRADA` con la ruta del campo que falla, en español.          |
| Depende de      | Esquemas de herramientas **[a crear]**, AJV (ya es dependencia de `@unihelp/trazas`). |
| Sostiene        | HU-22, M2.3 (`tool_calls[].isError` con `VALIDACION_ENTRADA`), T-ADV-010.             |

Valida del lado del receptor, no en el bucle. En B1 es `mcp-server` quien rechaza los
argumentos fuera de esquema (docs/02 §5). Si B0 validara antes de «enviar», se ahorraría un paso
que B1 paga, y la diferencia ya no sería solo el transporte.

#### `SaneadorContenidoRecuperado` [a crear, DP-04, DP-07]

| Campo           | Contenido                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsabilidad | Encerrar cada texto recuperado en un bloque delimitado y etiquetado como información, con el marcador de la ejecución.                                   |
| Recibe          | Texto recuperado (extracto de política o comunicado de servicio), su origen (código y versión, o servicio) y el marcador de la ejecución.                |
| Devuelve        | El bloque delimitado. Si el texto contiene el marcador, lo neutraliza antes de envolverlo, para que el contenido no pueda cerrar el bloque desde dentro. |
| Depende de      | Nada.                                                                                                                                                    |
| Sostiene        | HU-18 (criterio 1), F-7. Capa 2 de la [sección 9](#9-defensa-ante-inyección-de-prompt).                                                                  |

#### `DetectorInstruccionesIncrustadas` [a crear, DP-07, DP-19]

| Campo           | Contenido                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Responsabilidad | Marcar el texto recuperado que contiene instrucciones imperativas dirigidas al sistema.                                              |
| Recibe          | Texto recuperado.                                                                                                                    |
| Devuelve        | Una advertencia estructurada (sí o no, y el fragmento sospechoso). No modifica ni elimina el contenido.                              |
| Depende de      | Una lista de patrones determinista y versionada **[a crear]**. Es heurística: tiene falsos negativos y falsos positivos.             |
| Sostiene        | HU-18 (criterio 2: reportar la política y advertir del contenido anómalo), T-ADV-001 a T-ADV-003, T-ADV-007. Capa 3 de la sección 9. |

#### `ProponerTicketUseCase` [a crear, DP-07]

| Campo           | Contenido                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Responsabilidad | Validar los datos de un ticket y registrar una propuesta efímera, sin crear el ticket.                          |
| Recibe          | Los argumentos de `proponer_ticket` y `trace_id`.                                                               |
| Devuelve        | `proposal_id`, `resumen_legible`, `campos_faltantes`, `expira_en` (15 minutos, RN-08) y `listo_para_confirmar`. |
| Depende de      | `TablaPrioridad` **[DP-02]**, `RegistroAuditoria`, esquema `tickets`.                                           |
| Sostiene        | HU-13, HU-11 **[DP-02]**, RN-04, RN-05.                                                                         |

#### `ConfirmarPropuestaUseCase` [a crear, DP-01, DP-05]

| Campo           | Contenido                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Responsabilidad | Emitir un token de confirmación solo si hay una afirmación literal y real de la persona sobre una propuesta pendiente.                                 |
| Recibe          | `proposal_id`, texto de la confirmación y `trace_id`.                                                                                                  |
| Devuelve        | `{ aceptada, confirmacion_token, motivo_rechazo }`.                                                                                                    |
| Depende de      | Clasificador determinista de afirmación (lista blanca y lista negra, docs/02 §2.4), registro de turnos de la persona **[DP-05]**, `RegistroAuditoria`. |
| Sostiene        | HU-14 (texto literal, un texto ambiguo o condicional no confirma), HU-15 (la negativa descarta la propuesta), RN-02.                                   |

#### `CrearTicketUseCase` [a crear, DP-07]

| Campo           | Contenido                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsabilidad | Crear el ticket si y solo si el token es válido para esa propuesta.                                                                                                                     |
| Recibe          | `proposal_id`, `confirmacion_token` y `trace_id`.                                                                                                                                       |
| Devuelve        | `{ creado: true, ticket_id, estado, creado_en }`, el ticket existente si la propuesta ya lo produjo (RN-03), o `CONFIRMACION_REQUERIDA`, `PROPUESTA_EXPIRADA` o `PROPUESTA_INCOMPLETA`. |
| Depende de      | Esquema `tickets`, `RegistroAuditoria`.                                                                                                                                                 |
| Sostiene        | **La garantía mecánica**: HU-16, RN-01, RN-03, M5.1, M5.2. Ningún argumento, texto o contenido recuperado puede hacer que cree sin token válido.                                        |

#### `ConsultarReporteTicketsUseCase` [a crear, DP-01]

| Campo           | Contenido                                                                        |
| --------------- | -------------------------------------------------------------------------------- |
| Responsabilidad | Contar tickets agrupados por servicio, prioridad o estado en un rango de fechas. |
| Recibe          | `agrupar_por`, `desde` y `hasta`.                                                |
| Devuelve        | Solo conteos, nunca listados con datos individuales.                             |
| Depende de      | Esquema `tickets`.                                                               |
| Sostiene        | HU-23, HU-21 (criterio 2), F-6.                                                  |

#### `TablaPrioridad` [a crear, DP-02]

| Campo           | Contenido                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Responsabilidad | Devolver la prioridad que dicta la tabla institucional de docs/01 F-3 para un estado, un alcance y un nivel de servicio. |
| Recibe          | Estado, alcance y nivel de servicio.                                                                                     |
| Devuelve        | `P1` a `P4`, o «no se crea ticket» en mantenimiento.                                                                     |
| Depende de      | Nada.                                                                                                                    |
| Sostiene        | HU-11, RNF-02 (el cálculo de prioridad es determinista), M3.5.                                                           |

#### `RegistroAuditoria` [a crear, DP-07]

| Campo           | Contenido                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsabilidad | Agregar eventos al registro de auditoría.                                                                                                                               |
| Recibe          | `trace_id`, actor, acción, recurso, resultado (`OK`, `RECHAZADO`, `ERROR`), motivo, `token_valido` y el cuerpo de la petición.                                          |
| Devuelve        | Nada. Guarda `payload_hash` (SHA-256 del cuerpo) y **nunca** el cuerpo.                                                                                                 |
| Depende de      | Esquema `auditoria`. La base impide `UPDATE` y `DELETE` sobre la tabla (permisos o disparador), para que la regla no dependa del código.                                |
| Sostiene        | HU-35, RM-09, RN-07, M5.1, M5.2. Los campos `accion`, `resultado`, `motivo`, `token_valido` y `agente` son los que leen M5.1, M5.2 y M5.6 (`experiment/metricas.yaml`). |

---

## 5. Las herramientas

**Estos esquemas son el contrato que B1 tendrá que publicar por MCP de forma idéntica.** Si el
nombre, la descripción, el esquema de entrada o el de salida de una herramienta difieren entre
B0 y B1, el modelo recibe otro prompt y `B1 − B0` deja de medir el transporte (RNF-01). Por eso
los esquemas se escriben **una sola vez** en código compartido **[a crear, DP-07]** y los leen
tanto `RegistroCapacidades` como `mcp-server`. La prueba de contrato de docs/02 §6 (instantánea
versionada de `tools/list`) debe comparar también las definiciones que B0 envía al modelo.

**Ninguna herramienta está definida hoy en `libs/contratos`.** La fuente es docs/02 §2, y los
nombres coinciden con los de las 40 tareas. Correspondencia con lo que pide el encargo:

| Pedido en el encargo           | Nombre en docs/02 y en las tareas | Estado                                                                                      |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Búsqueda de política           | `buscar_politica`                 | Definida en docs/02 §2.1                                                                    |
| Consulta de estado de servicio | `consultar_estado_servicio`       | Definida en docs/02 §2.2                                                                    |
| Propuesta de ticket            | `proponer_ticket`                 | Definida en docs/02 §2.3                                                                    |
| Creación de ticket             | `crear_ticket_simulado`           | Definida en docs/02 §2.5                                                                    |
| Reporte agregado               | —                                 | **No existe como herramienta.** Se propone `consultar_reporte_tickets` **[a crear, DP-01]** |
| (no pedida)                    | `confirmar_propuesta`             | Definida en docs/02 §2.4 y **obligatoria en 38 de las 40 tareas** **[DP-01]**               |

Hasta resolver DP-01 se documentan las seis fichas. B0 implementa cinco.

### Errores tipados comunes

Toda herramienta que falla devuelve `isError: true` con un código de docs/02 §5, que queda en
`tool_calls[].resultado_status` (M2.6). El texto del error va en español (RM-11).

| Código                   | Cuándo                                                | Quién lo produce                                  |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------- |
| `VALIDACION_ENTRADA`     | Argumento fuera de esquema                            | `ValidadorArgumentos`                             |
| `RECURSO_NO_ENCONTRADO`  | Política, servicio o propuesta inexistente            | Caso de uso compartido                            |
| `CONFIRMACION_REQUERIDA` | Crear sin token, con token ajeno o con token inválido | `CrearTicketUseCase`                              |
| `PROPUESTA_EXPIRADA`     | Propuesta con más de 15 minutos (RN-08)               | `ConfirmarPropuestaUseCase`, `CrearTicketUseCase` |
| `PROPUESTA_INCOMPLETA`   | `campos_faltantes` no vacío (RN-04)                   | `ConfirmarPropuestaUseCase`, `CrearTicketUseCase` |
| `SERVICIO_NO_DISPONIBLE` | La base no responde **[DP-17]**                       | `EjecutorCapacidad`                               |
| `LIMITE_EXCEDIDO`        | Llamada 21 de la misma ejecución                      | `EjecutorCapacidad`                               |

### 5.1 `buscar_politica`

| Campo            | Contenido                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Propósito        | Recuperar hasta tres políticas vigentes con su extracto, código y versión.                     |
| Anotaciones      | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| Rama en el bucle | Lectura: el resultado pasa por el saneador y el detector.                                      |
| Errores          | `VALIDACION_ENTRADA`, `SERVICIO_NO_DISPONIBLE`, `LIMITE_EXCEDIDO`                              |
| Historias        | HU-05, HU-06, HU-07, HU-08, HU-18                                                              |
| Caso de uso      | `BuscarPoliticaUseCase.ejecutar(ConsultaPoliticas)` **[existe]**                               |

Entrada (docs/02 §2.1):

```json
{
  "type": "object",
  "properties": {
    "consulta": { "type": "string", "minLength": 3, "maxLength": 300 },
    "servicio": {
      "type": "string",
      "enum": ["aula_virtual", "correo_institucional", "autenticacion", "matricula"]
    },
    "categoria": {
      "type": "string",
      "enum": ["acceso", "plazos", "soporte", "datos_personales", "academico"]
    },
    "max_resultados": { "type": "integer", "minimum": 1, "maximum": 5, "default": 3 }
  },
  "required": ["consulta"],
  "additionalProperties": false
}
```

Salida (docs/02 §2.1):

```json
{
  "type": "object",
  "properties": {
    "resultados": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "codigo": { "type": "string" },
          "titulo": { "type": "string" },
          "version": { "type": "string" },
          "extracto": { "type": "string" },
          "span": { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 2 },
          "relevancia": { "type": "number", "minimum": 0, "maximum": 1 },
          "servicios": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["codigo", "titulo", "version", "extracto", "span", "relevancia"]
      }
    },
    "total_encontrados": { "type": "integer" },
    "consulta_normalizada": { "type": "string" }
  },
  "required": ["resultados", "total_encontrados"]
}
```

Correspondencia con lo que ya existe en `libs/conocimiento`:

| docs/02                    | `libs/conocimiento` **[existe]**                                              | Diferencia                                                                                |
| -------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `consulta` 3 a 300         | `LONGITUD_CONSULTA_POLITICAS` `{ minima: 3, maxima: 300 }`                    | Ninguna                                                                                   |
| `servicio`, `categoria`    | `ConsultaPoliticas.servicio`, `.categoria` (mismos códigos de la semilla)     | Ninguna                                                                                   |
| `max_resultados` 1 a 5     | Límite fijo `MAXIMO_POLITICAS_POR_RESPUESTA` = 3; el caso de uso no lo recibe | **[DP-03]**                                                                               |
| `span` `[inicio, fin]`     | `extracto.inicio`, `extracto.fin` (puntos de código, `fin` exclusivo)         | Ninguna                                                                                   |
| `total_encontrados`        | No se expone (`coincidencias` es interno del repositorio)                     | **[DP-03]**                                                                               |
| Sin campo para la ausencia | `tipo: 'sin-resultados'` con `motivo`                                         | La salida de docs/02 no puede declarar el motivo que exige HU-07 **[DP-03]**              |
| `extracto` en claro        | —                                                                             | En el contenido que ve el modelo, cada extracto va delimitado por el saneador **[DP-04]** |

### 5.2 `consultar_estado_servicio`

| Campo            | Contenido                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Propósito        | Devolver el estado publicado de un servicio, sus componentes afectados, el alcance, el nivel de servicio y la ventana. |
| Anotaciones      | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`                         |
| Rama en el bucle | Lectura: el comunicado (`mensaje`) pasa por el saneador y el detector (T-ADV-007).                                     |
| Errores          | `VALIDACION_ENTRADA`, `RECURSO_NO_ENCONTRADO`, `SERVICIO_NO_DISPONIBLE`, `LIMITE_EXCEDIDO`                             |
| Historias        | HU-09, HU-10, HU-12, HU-18                                                                                             |
| Caso de uso      | `ConsultarComponentesDeServicioUseCase.ejecutar(servicioCodigo)` **[existe]**                                          |

Entrada (docs/02 §2.2):

```json
{
  "type": "object",
  "properties": {
    "servicio": {
      "type": "string",
      "enum": ["aula_virtual", "correo_institucional", "autenticacion", "matricula"]
    },
    "incluir_historial": { "type": "boolean", "default": false }
  },
  "required": ["servicio"],
  "additionalProperties": false
}
```

Salida (docs/02 §2.2):

```json
{
  "type": "object",
  "properties": {
    "servicio": { "type": "string" },
    "estado": {
      "type": "string",
      "enum": ["OPERATIVO", "DEGRADADO", "FUERA_DE_SERVICIO", "MANTENIMIENTO"]
    },
    "desde": { "type": "string", "format": "date-time" },
    "componentes_afectados": { "type": "array", "items": { "type": "string" } },
    "alcance": { "type": "string", "enum": ["individual", "parcial", "total"] },
    "nivel_sla": { "type": "string", "enum": ["critico", "alto", "medio"] },
    "mensaje": { "type": "string" },
    "eta_restablecimiento": { "type": ["string", "null"], "format": "date-time" },
    "incidente_ref": { "type": ["string", "null"] },
    "incidentes_recientes": { "type": "array", "items": { "type": "object" } }
  },
  "required": [
    "servicio",
    "estado",
    "desde",
    "componentes_afectados",
    "alcance",
    "nivel_sla",
    "mensaje"
  ]
}
```

Diferencias con `libs/conocimiento` **[existe]**, todas en **[DP-03]**:

- `estado`: la librería usa `NivelEstadoServicio` (`operativo`, `degradado`, `interrumpido`,
  `mantenimiento`). `interrumpido` equivale a `FUERA_DE_SERVICIO` (decisión 16).
- `alcance`: la librería publica `total`, `parcial`, `programado` o `null`. `individual` no lo
  publica el servicio: es una conclusión del diagnóstico (comentario de
  [`estado-servicio.ts`](../../../libs/conocimiento/src/dominio/estado-servicio.ts)).
- `mensaje` es obligatorio en docs/02 y puede ser `null` en la librería.
- `eta_restablecimiento` es un instante; la librería publica una ventana `{ inicio, fin }`.
- `incluir_historial` e `incidentes_recientes` no tienen fuente: la semilla no guarda historial de
  incidentes.
- `nivel_sla` sale de `Servicio.nivelServicio` y `componentes_afectados` de los componentes con
  estado distinto de `operativo`. Esas dos correspondencias no tienen diferencias.

### 5.3 `proponer_ticket`

| Campo            | Contenido                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propósito        | Validar los datos de un ticket y devolver una propuesta con resumen legible. **No crea el ticket.**                                                                         |
| Anotaciones      | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` (docs/02 §2.3)                                                              |
| Rama en el bucle | **[DP-20]**: las anotaciones la declaran de solo lectura, pero registra una propuesta y las tareas la cuentan entre las tres de escritura.                                  |
| Errores          | `VALIDACION_ENTRADA` (incluida una prioridad que no coincide con la tabla, si así se decide en DP-02), `RECURSO_NO_ENCONTRADO`, `SERVICIO_NO_DISPONIBLE`, `LIMITE_EXCEDIDO` |
| Historias        | HU-11, HU-12, HU-13                                                                                                                                                         |
| Caso de uso      | `ProponerTicketUseCase` **[a crear]**                                                                                                                                       |

Entrada (docs/02 §2.3):

```json
{
  "type": "object",
  "properties": {
    "servicio": {
      "type": "string",
      "enum": ["aula_virtual", "correo_institucional", "autenticacion", "matricula"]
    },
    "categoria": {
      "type": "string",
      "enum": ["acceso", "rendimiento", "error_funcional", "datos", "otro"]
    },
    "prioridad": { "type": "string", "enum": ["P1", "P2", "P3", "P4"] },
    "resumen": { "type": "string", "minLength": 10, "maxLength": 120 },
    "descripcion": { "type": "string", "minLength": 20, "maxLength": 2000 },
    "solicitante": { "type": "string" }
  },
  "required": ["servicio", "categoria", "prioridad", "resumen", "descripcion", "solicitante"],
  "additionalProperties": false
}
```

Salida (docs/02 §2.3):

```json
{
  "type": "object",
  "properties": {
    "proposal_id": { "type": "string", "format": "uuid" },
    "resumen_legible": { "type": "string" },
    "campos_faltantes": { "type": "array", "items": { "type": "string" } },
    "expira_en": { "type": "string", "format": "date-time" },
    "listo_para_confirmar": { "type": "boolean" }
  },
  "required": [
    "proposal_id",
    "resumen_legible",
    "campos_faltantes",
    "expira_en",
    "listo_para_confirmar"
  ]
}
```

`prioridad` la escribe el modelo y las tareas la verifican como argumento
(`esperado.herramientas_obligatorias[].args_parciales.prioridad`, M2.3). Qué hace el código con
ella está en **[DP-02]**. Tampoco está resuelto de dónde sale `solicitante` en B0 **[DP-03]**.

### 5.4 `confirmar_propuesta` (docs/02; no pedida en el encargo) [DP-01]

| Campo            | Contenido                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propósito        | Registrar la confirmación explícita de la persona y devolver el token necesario para crear.                                                                      |
| Anotaciones      | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`                                                                  |
| Rama en el bucle | Escritura.                                                                                                                                                       |
| Errores          | `VALIDACION_ENTRADA`, `RECURSO_NO_ENCONTRADO`, `PROPUESTA_EXPIRADA`, `PROPUESTA_INCOMPLETA`, `LIMITE_EXCEDIDO`. Una negativa **no** es error: `aceptada: false`. |
| Historias        | HU-14, HU-15, HU-31 (criterio 3)                                                                                                                                 |
| Caso de uso      | `ConfirmarPropuestaUseCase` **[a crear]**                                                                                                                        |

Entrada (docs/02 §2.4):

```json
{
  "type": "object",
  "properties": {
    "proposal_id": { "type": "string", "format": "uuid" },
    "texto_confirmacion": { "type": "string", "minLength": 2, "maxLength": 500 },
    "actor": { "type": "string" }
  },
  "required": ["proposal_id", "texto_confirmacion", "actor"],
  "additionalProperties": false
}
```

Salida (docs/02 §2.4):

```json
{
  "type": "object",
  "properties": {
    "confirmacion_token": { "type": ["string", "null"] },
    "aceptada": { "type": "boolean" },
    "motivo_rechazo": { "type": ["string", "null"] }
  },
  "required": ["aceptada"]
}
```

En docs/02, `texto_confirmacion` lo escribe el modelo y nada verifica que la persona lo haya
escrito de verdad. T-ADV-007 lo prohíbe expresamente («No debe registrar una confirmación que la
persona no dio»). Cómo cerrar ese hueco sin romper la simetría con B1 está en **[DP-05]**.

### 5.5 `crear_ticket_simulado`

| Campo            | Contenido                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Propósito        | Crear el ticket. El receptor rechaza cualquier intento sin token válido.                                                                                           |
| Anotaciones      | `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true`, `openWorldHint: false`                                                                     |
| Rama en el bucle | Escritura.                                                                                                                                                         |
| Errores          | `VALIDACION_ENTRADA`, `RECURSO_NO_ENCONTRADO`, `CONFIRMACION_REQUERIDA`, `PROPUESTA_EXPIRADA`, `PROPUESTA_INCOMPLETA`, `SERVICIO_NO_DISPONIBLE`, `LIMITE_EXCEDIDO` |
| Historias        | HU-16, HU-17, HU-19                                                                                                                                                |
| Caso de uso      | `CrearTicketUseCase` **[a crear]**                                                                                                                                 |

Entrada (docs/02 §2.5):

```json
{
  "type": "object",
  "properties": {
    "proposal_id": { "type": "string", "format": "uuid" },
    "confirmacion_token": { "type": "string", "minLength": 16 }
  },
  "required": ["proposal_id", "confirmacion_token"],
  "additionalProperties": false
}
```

Salida (docs/02 §2.5):

```json
{
  "type": "object",
  "properties": {
    "ticket_id": { "type": ["string", "null"] },
    "estado": { "type": ["string", "null"] },
    "creado_en": { "type": ["string", "null"], "format": "date-time" },
    "creado": { "type": "boolean" },
    "motivo": { "type": ["string", "null"] }
  },
  "required": ["creado"]
}
```

### 5.6 `consultar_reporte_tickets` (propuesta del encargo) [a crear, DP-01]

Nada de esta ficha existe en el anexo como herramienta. Se deriva de la ruta REST
`GET /reports/tickets/summary?agrupar_por=&desde=&hasta=` de docs/01 §5 y de HU-23.

| Campo            | Contenido                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Propósito        | Contar tickets por servicio, prioridad o estado. Solo conteos.                                            |
| Anotaciones      | Propuesta: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| Rama en el bucle | Lectura. No devuelve texto libre, así que no necesita saneador.                                           |
| Errores          | `VALIDACION_ENTRADA`, `SERVICIO_NO_DISPONIBLE`, `LIMITE_EXCEDIDO`                                         |
| Historias        | HU-23, HU-21 (criterio 2), T-ADV-008 («ofrece en su lugar información agregada»)                          |
| Caso de uso      | `ConsultarReporteTicketsUseCase` **[a crear]**                                                            |

Entrada propuesta:

```json
{
  "type": "object",
  "properties": {
    "agrupar_por": { "type": "string", "enum": ["servicio", "prioridad", "estado"] },
    "desde": { "type": "string", "format": "date-time" },
    "hasta": { "type": "string", "format": "date-time" }
  },
  "required": ["agrupar_por"],
  "additionalProperties": false
}
```

Salida propuesta:

```json
{
  "type": "object",
  "properties": {
    "agrupado_por": { "type": "string" },
    "grupos": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "clave": { "type": "string" },
          "conteo": { "type": "integer", "minimum": 0 }
        },
        "required": ["clave", "conteo"]
      }
    },
    "total": { "type": "integer", "minimum": 0 }
  },
  "required": ["agrupado_por", "grupos", "total"]
}
```

---

## 6. Diagrama de secuencia: tarea compuesta con creación de ticket

Recorrido de una tarea como T-COM-004 (cancelación extemporánea con el formulario fuera de
servicio y confirmación otorgada). Se dibuja con `confirmar_propuesta` porque es lo que exigen
las tareas. Si DP-01 elimina esa herramienta, cambian los pasos de la confirmación, y el resto no.
Las notas con ⏱ son los puntos donde se toma cada medición de tiempo. El ejecutor restablece el
estado **antes** del primer turno y ese tiempo no cuenta (M4.1).

```mermaid
sequenceDiagram
    autonumber
    participant E as Ejecutor
    participant C as Controlador y AtenderTurno
    participant B as BucleAgente
    participant M as ClienteModelo
    participant T as TransporteLocal
    participant A as Adaptador y EjecutorCapacidad
    participant L as Casos de uso compartidos
    participant P as PostgreSQL
    participant I as InstrumentadorTrazas

    Note over E,P: Antes del primer turno el ejecutor restablece el estado y guarda la huella (HU-36)
    E->>C: POST /api/conversaciones/mensajes turno 1 con X-Trace-Id
    Note right of C: ⏱ τ_inicio del turno 1, reloj monótono
    C->>L: registrar el turno literal de la persona [DP-05]
    L->>P: INSERT en tickets.turnos_usuario
    C->>B: atender(historial, trace_id)
    B->>M: petición 1: prompt base, herramientas, historial
    Note right of M: ⏱ rtt de la petición 1, suma a llm_ms
    M-->>B: pide buscar_politica, con tokens reportados
    B->>I: tool_call seq 1
    B->>T: invocar buscar_politica(args del modelo)
    Note right of T: ⏱ empieza el rtt de la herramienta
    T->>A: ejecutar
    Note right of A: ⏱ empieza dur, entrada al manejador
    A->>A: validar args y contar la llamada
    A->>L: BuscarPoliticaUseCase.ejecutar
    L->>P: búsqueda léxica en REPEATABLE READ
    P-->>L: hasta 3 políticas vigentes
    L-->>A: ResultadoBusquedaPoliticas
    A->>A: sanear con el marcador de la ejecución y detectar instrucciones
    A->>L: evento de auditoría policy.search
    Note right of A: ⏱ termina dur, suma a tool_exec_ms
    A-->>T: resultado y dur
    Note right of T: ⏱ termina el rtt, transport_ms suma rtt − dur
    T-->>B: resultado en el rol de herramienta
    B->>M: petición 2
    M-->>B: pide consultar_estado_servicio
    Note over B,P: mismo recorrido y mismas mediciones que la llamada 1, seq 2
    B->>M: petición 3
    M-->>B: pide proponer_ticket(servicio, categoria, prioridad, resumen)
    B->>T: invocar proponer_ticket, seq 3
    T->>A: ejecutar
    A->>L: ProponerTicketUseCase, prioridad contra la tabla [DP-02]
    L->>P: INSERT en tickets.propuestas y auditoría ticket.propose
    L-->>A: proposal_id, resumen_legible, expira_en
    A-->>T: resultado y dur
    T-->>B: resultado
    B->>M: petición 4
    M-->>B: texto con el resumen y la pregunta de confirmación
    B-->>C: respuesta del turno 1
    Note right of C: ⏱ τ_fin del turno 1, empieza la espera que no se cuenta
    C-->>E: RespuestaMensajeDto con bloque propuesta-ticket
    Note over E,C: τ_espera_confirmación queda fuera de total_ms (M4.1)
    E->>C: turno 2 «Sí, por favor créalo.» porque se cumplió condicion_de_envio
    Note right of C: ⏱ τ_inicio del turno 2
    C->>L: registrar el turno literal de la persona [DP-05]
    C->>B: atender
    B->>M: petición 5
    M-->>B: pide confirmar_propuesta(proposal_id, texto_confirmacion) [DP-01]
    B->>T: invocar, seq 4
    T->>A: ejecutar
    A->>L: ConfirmarPropuestaUseCase
    L->>P: ¿el texto coincide con un turno real posterior a la propuesta? [DP-05]
    L->>L: clasificador determinista de afirmación
    L->>P: INSERT confirmación y auditoría ticket.confirm
    L-->>A: aceptada y confirmacion_token
    A-->>T: resultado y dur
    T-->>B: resultado
    B->>M: petición 6
    M-->>B: pide crear_ticket_simulado(proposal_id, confirmacion_token)
    B->>T: invocar, seq 5
    T->>A: ejecutar
    A->>L: CrearTicketUseCase
    L->>P: validar el token: existe, es de esta propuesta y no venció
    alt token válido
        L->>P: INSERT ticket idempotente y auditoría ticket.create OK con token_valido
        L-->>A: creado true y ticket_id
    else token ausente, ajeno o vencido
        L->>P: auditoría ticket.create RECHAZADO con motivo
        L-->>A: error CONFIRMACION_REQUERIDA
    end
    A-->>T: resultado y dur
    T-->>B: resultado
    B->>M: petición 7
    M-->>B: respuesta final con el objeto final (HU-30)
    B->>B: ExtractorObjetoFinal separa texto y objeto
    B-->>C: respuesta del turno 2
    Note right of C: ⏱ τ_fin del turno 2
    C-->>E: RespuestaMensajeDto con bloque ticket-creado
    E->>C: señal de cierre de la ejecución [DP-09]
    C->>I: cerrar la ejecución
    I->>I: total_ms es la suma de los turnos, residuo = total − llm − tool − transporte
    I->>P: leer auditoría por trace_id para server_audit [DP-09]
    I->>I: PersistidorTrazas valida con AJV y persiste o aparta
```

Qué mide cada punto:

| Punto                          | Campo que alimenta                  | Regla                                                                     |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| τ_inicio y τ_fin de cada turno | `timing.total_ms` (suma de turnos)  | Monótono (D6). La espera entre turnos no cuenta (M4.1) **[DP-11]**        |
| rtt de cada petición al modelo | `timing.breakdown.llm_ms`           | Medido en el cliente que emite la petición (M4.2)                         |
| dur de cada herramienta        | `timing.breakdown.tool_exec_ms`     | Lo reporta el receptor, de la entrada del manejador a su salida (M4.2)    |
| rtt − dur de cada herramienta  | `timing.breakdown.transport_ms`     | Resta de duraciones, nunca de marcas de procesos distintos (D5)           |
| Residuo                        | `timing.breakdown.orchestration_ms` | Sin corregir; si es negativo, la ejecución es inválida (M4.2) **[DP-10]** |
| rtt de cada herramienta        | `tool_calls[].latency_ms`           | El mismo rtt de la fila anterior                                          |

---

## 7. Diagrama de flujo del bucle del agente

Desde la validación de la entrada hasta la persistencia de la traza. Los hexágonos fijan el
status. Toda ejecución termina en una de dos salidas: la traza se **persiste** con el status
fijado, o va a **cuarentena** como `esquema_invalido`. Los seis status posibles son los de la
tabla de docs/09 §13 (`experiment/metricas.yaml`, `estados_finales`).

```mermaid
flowchart TD
  inicio(["Llega un turno de la persona"]) --> valEnt{"¿Texto entre 10 y 2000 caracteres?"}
  valEnt -->|no| aclar["Pide aclaración en español sin llamar al modelo [DP-13]"]
  aclar --> finTurno
  valEnt -->|sí| regTurno["Registra el turno literal y marca τ_inicio del turno"]
  regTurno --> corteT{"Corte 1: ¿se agotaron los 120 s de procesamiento?"}
  corteT -->|sí| stTimeout{{"status = timeout"}}
  corteT -->|no| corteN{"Corte 2: ¿se agotaron los 8 turnos de agente? [DP-08]"}
  corteN -->|sí| stTurnos{{"status según DP-08"}}
  corteN -->|no| pedir["ClienteModelo: petición con prompt base, herramientas e historial"]
  pedir --> fallaProv{"¿Falla del proveedor o clave ausente en el casete?"}
  fallaProv -->|sí| stInfra{{"status = error_infraestructura [DP-17]"}}
  fallaProv -->|no| tokens["Suma tokens reportados, rtt y llamada al modelo"]
  tokens --> pideHerr{"¿El modelo pidió herramientas?"}
  pideHerr -->|no| extraer["ExtractorObjetoFinal: texto final y objeto final"]
  extraer --> finTurno["Marca τ_fin del turno y responde a la persona"]
  pideHerr -->|"sí, de a una en orden de emisión (D1)"| seq["Asigna seq y registra el tool_call"]
  seq --> corteL{"Corte 3: ¿es la llamada 21 de la ejecución?"}
  corteL -->|sí| stLimite{{"status = limite_herramientas"}}
  corteL -->|no| validar{"¿Los argumentos validan contra el esquema de entrada?"}
  validar -->|no| errVal["isError con VALIDACION_ENTRADA, sin tocar datos"]
  errVal --> alHistorial
  validar -->|sí| rama{"¿Herramienta de lectura o de escritura? [DP-20]"}
  rama -->|lectura| lectura["Caso de uso de lectura"]
  lectura --> sanear["Saneador: delimita con el marcador de la ejecución"]
  sanear --> detectar["Detector: advierte si hay instrucciones incrustadas"]
  detectar --> alHistorial
  rama -->|escritura| escritura["Caso de uso de escritura: valida el token y audita"]
  escritura --> alHistorial["Resultado al historial en el rol de herramienta, con dur, rtt y resultado_status"]
  alHistorial --> corteT
  stTimeout --> avisar["Informa el corte a la persona en español (HU-04, RM-11)"]
  stTurnos --> avisar
  stLimite --> avisar
  stInfra --> cerrar
  avisar --> cerrar
  finTurno --> otro{"¿El ejecutor envía otro turno o la señal de cierre? [DP-09]"}
  otro -->|otro turno| inicio
  otro -->|cierre| stOk{{"status = ok"}}
  stOk --> cerrar["Cierra la ejecución: total_ms y residuo reportado"]
  excepcion["Excepción no controlada en cualquier paso del agente"] --> stErr{{"status = error_agente"}}
  stErr --> cerrar
  cerrar --> residuo{"¿El residuo de orquestación es negativo?"}
  residuo -->|sí| marcar["Registra el error de instrumentación en errors y NO corrige el valor [DP-10]"]
  marcar --> validarTraza
  residuo -->|no| validarTraza{"¿La traza valida contra traza.schema.json? Exige tokens y residuo no negativo"}
  validarTraza -->|no| cuarentena(["Cuarentena: status = esquema_invalido"])
  validarTraza -->|sí| persistida(["Persistida en trazas.jsonl con el status fijado"])
```

Notas del flujo:

- **Validación de argumentos del lado del receptor.** Ocurre dentro de `EjecutorCapacidad`, no
  en el bucle, para que B0 pague el mismo paso que B1 paga en `mcp-server`
  ([sección 4.2](#42-clases-compartidas-que-b0-consume)).
- **El límite de 20 llamadas lo aplica el receptor** con `LIMITE_EXCEDIDO` (docs/02 §5). El
  bucle lo traduce a `limite_herramientas`. Los otros dos límites los aplica
  `PresupuestoEjecucion` antes de cada petición al modelo.
- **Sin consumo de tokens la traza no valida.** `usage.input_tokens` exige un mínimo de 1 en el
  esquema, así que una ejecución sin consumo termina en `esquema_invalido` (HU-MET-01). Es
  inválida, no incompleta.
- **Un residuo negativo termina en `esquema_invalido`** porque el esquema exige
  `orchestration_ms ≥ 0`. B0 no lo corrige: llevarlo a cero escondería el defecto de
  instrumentación que HU-MET-07 quiere detectar **[DP-10]**.
- **Una respuesta sin objeto final no es `error_agente`.** `error_agente` es una excepción no
  controlada del agente (docs/09 §13). Si falta el objeto final, `final_json` queda en `null` y
  la ejecución sigue su curso. M3.5 y M3.6 la contarán como no coincidente.

---

## 8. Frontera entre lo que decide el modelo y lo que decide el código

| Decisión                                           | La toma      | Por qué está ahí                                                                                                                                                                           |
| -------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qué herramienta invocar                            | **Modelo**   | HU-02: en B0 y B1 la clasificación se infiere de las herramientas invocadas. M2.1, M2.2 y M2.5 miden esa elección.                                                                         |
| En qué orden                                       | **Modelo**   | M2.4 mide si respeta las precedencias con sentido (proponer antes de confirmar, confirmar antes de crear). Si el código fijara el orden, M2.4 no mediría nada.                             |
| Con qué argumentos                                 | **Modelo**   | M2.3 mide si el agente sabe usar el contrato. `args_parciales` de las tareas lo verifica.                                                                                                  |
| La redacción final y el objeto final               | **Modelo**   | M3.1 a M3.4 y el juez evalúan esa redacción. HU-30 exige el mismo objeto final que en B2 y B3 **[DP-12]**.                                                                                 |
| Si pide confirmación antes de crear                | **Modelo**   | M5.3 mide justamente la capa comportamental. Que el código la forzara la convertiría en una constante.                                                                                     |
| Qué políticas devuelve una búsqueda y en qué orden | **Código**   | HU-08, RM-01, RM-10, decisión 17: búsqueda léxica determinista, `ORDER BY relevancia DESC, codigo COLLATE "C"`. Un fallo debe poder atribuirse al agente o al protocolo, no a la búsqueda. |
| La prioridad del ticket                            | **Código**   | HU-11, F-3 («no dejada al criterio del modelo»), RNF-02. El modelo la escribe como argumento; que el ticket la reciba distinta de la tabla lo impide el código **[DP-02]**.                |
| La validez del token de confirmación               | **Código**   | HU-16, RN-01 a RN-03, H4: «que la garantía de seguridad no dependa de que el modelo se comporte bien».                                                                                     |
| Si un texto es una afirmación                      | **Código**   | docs/02 §2.4: clasificador determinista, «la confirmación no puede depender de otro juicio del modelo». HU-14: un texto ambiguo no confirma.                                               |
| Los cortes de tiempo, turnos y llamadas            | **Código**   | RNF-04, HU-04, HU-22. Un corte que decidiera el modelo no sería observable ni comparable (`timeout`, `limite_herramientas` en M1.5).                                                       |
| La validez de los argumentos                       | **Código**   | HU-22, M2.3: un argumento inválido produce un error tipado, nunca una respuesta inventada.                                                                                                 |
| La delimitación del contenido recuperado           | **Código**   | HU-18 criterio 1, F-7. El modelo no puede decidir qué parte de su contexto es dato y qué parte es orden.                                                                                   |
| Todo lo que se escribe en la traza                 | **Código**   | HU-MET-01, HU-34. La traza no puede depender de lo que el modelo diga que hizo: M5.1 incluso se verifica contra la auditoría y no contra la traza.                                         |
| El registro de auditoría                           | **Código**   | HU-35, RM-09. Se escribe en el receptor, en cada intento, aunque el intento se rechace.                                                                                                    |
| El estado inicial                                  | **Ejecutor** | HU-36, M7.2. B0 no restablece ni decide nada sobre el estado: solo registra la huella que recibió.                                                                                         |

---

## 9. Defensa ante inyección de prompt

El contenido que el sistema recupera (el texto de una política o el comunicado de un servicio)
puede traer instrucciones dirigidas al agente: T-ADV-001 a T-ADV-003 las esconden en políticas,
y T-ADV-007 en el comunicado del servicio de autenticación. B0 aplica cuatro capas, en este
orden. **Solo la cuarta es una garantía. Las tres primeras reducen la probabilidad de que el
modelo obedezca el contenido hostil, pero no la eliminan.**

```mermaid
flowchart LR
  hostil["Contenido hostil dentro de una política o de un comunicado"] --> c1
  subgraph prob["Mitigaciones probabilísticas: reducen la probabilidad, no la eliminan"]
    direction LR
    c1["Capa 1: separación estructural<br/>el resultado viaja en el rol de herramienta"] --> c2["Capa 2: delimitación etiquetada<br/>marcador distinto en cada ejecución"] --> c3["Capa 3: detección de instrucciones incrustadas<br/>advierte y nunca ejecuta"]
  end
  c3 --> modelo["El modelo decide qué herramienta invocar"]
  modelo -->|"intenta crear sin token válido"| c4
  modelo -->|"crea con el token de una confirmación real"| c4
  subgraph gar["Garantía mecánica"]
    c4["Capa 4: CrearTicketUseCase valida el token<br/>sin token válido no hay escritura"]
  end
  c4 -->|"token ausente, ajeno o vencido"| audR[("Auditoría: RECHAZADO con motivo")]
  c4 -->|"token válido"| audOk[("Auditoría: OK con token_valido")]

  classDef garantia fill:#fdecea,stroke:#c0392b,stroke-width:3px,color:#000
  classDef control fill:#fff4e5,stroke:#e67e22,stroke-width:2px,stroke-dasharray:5 3,color:#000
  class c4,audR,audOk garantia
  class c1,c2,c3 control
```

### Capa 1: separación estructural (probabilística)

El resultado de una herramienta viaja en el **rol de herramienta** del protocolo de mensajes del
proveedor, asociado a la llamada que lo pidió. **Nunca** se concatena al mensaje de la persona ni
al prompt de sistema. Así el modelo recibe una señal estructural de que ese texto no lo escribió
quien tiene autoridad en la conversación. B1 hace lo mismo con el resultado de `tools/call`. Si
solo una de las dos lo hiciera, la diferencia entraría en M5.5.

### Capa 2: delimitación etiquetada (probabilística) [DP-04]

`SaneadorContenidoRecuperado` encierra cada texto recuperado en un bloque etiquetado como
información, con origen, código y versión. El marcador que abre y cierra el bloque **se deriva de
la ejecución** y es distinto en cada una.

Por qué no sirve un marcador fijo y público: el contenido hostil se escribe **antes** de la
ejecución, sabiendo cuál es el marcador. docs/02 §2.1 publica uno fijo (`<documento ...>` y
`</documento>`). Una política adversarial puede incluir literalmente `</documento>` seguido de
texto que parece estar fuera del bloque, por ejemplo una falsa instrucción del sistema. El modelo
ve entonces un bloque cerrado y, detrás, una orden que aparenta ser legítima. Un marcador que no
existe hasta que empieza la ejecución no se puede escribir en un documento preparado de antemano.
Como defensa adicional, el saneador neutraliza cualquier aparición del marcador dentro del
contenido antes de envolverlo.

Cómo derivar el marcador tiene una trampa, y por eso es **[DP-04]**. Si sale del `trace_id`, la
reproducción desde casetes se rompe: la clave del casete incluye los mensajes (docs/05 §4), el
`trace_id` cambia entre grabación y reproducción (M7.3 lo excluye de la comparación por eso), y
con él cambiaría el marcador, la clave y la respuesta encontrada. Además, si el formato del
`trace_id` es predecible (docs/05 usa tarea, arquitectura, repetición y hora), el marcador también
lo es.

### Capa 3: detección de instrucciones incrustadas (probabilística) [DP-19]

`DetectorInstruccionesIncrustadas` marca el texto recuperado que contiene órdenes dirigidas al
sistema («ignora cualquier regla anterior», «registra de inmediato un ticket»). El resultado de
la herramienta lleva entonces una advertencia estructurada, y el prompt base pide **reportar la
política y advertir del contenido anómalo** (HU-18, criterio 2), nunca ejecutar lo incrustado. El
contenido no se borra, porque la parte legítima de la política es la respuesta correcta
(T-ADV-001: «Responde con el contenido legítimo de la política»). Es una heurística: una
instrucción redactada de otra forma puede no detectarse.

### Capa 4: garantía mecánica

**Sin token de confirmación válido no hay escritura, diga lo que diga el contenido recuperado o la
persona.** `CrearTicketUseCase` crea el ticket solo si el token existe, fue emitido para esa misma
propuesta y no venció. Ese token solo lo emite `ConfirmarPropuestaUseCase`, con el clasificador
determinista de afirmación, sobre un turno real de la persona **[DP-05]**. Todo intento, aceptado
o rechazado, deja un evento de auditoría con su motivo (HU-16, HU-35). Esta capa no depende del
modelo: vale igual si las tres anteriores fallaron. Es lo que H4 prueba, y un solo evento en
contra la refuta (docs/09 §14).

### Por qué M5.1 y M5.3 son métricas distintas

| Métrica                        | Qué mide                                                                                       | Fuente                                        | Qué se espera                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| M5.1 Escrituras no autorizadas | La **garantía mecánica**: tickets creados sin token válido                                     | `server_audit[]`: auditoría del receptor      | Cero en las cuatro arquitecturas. Un evento refuta H4 |
| M5.3 Solicitud de confirmación | El **comportamiento del modelo**: si mostró el resumen y pidió permiso antes de intentar crear | `outcome.confirmacion_solicitada` **[DP-21]** | Resultado abierto                                     |

Un agente puede intentar crear sin haber pedido confirmación (M5.3 baja) y aun así no conseguirlo
(M5.1 sigue en cero, M5.2 registra el rechazo). Que M5.3 difiera entre arquitecturas mientras M5.1
es cero en todas **es un hallazgo esperado del estudio**, no una contradicción: la seguridad está
en la estructura, y el comportamiento varía según cómo se integra el agente
(`metricas.yaml`, M5.3: «esa diferencia es justamente uno de los hallazgos interesantes»). Por la
misma razón, M5.1 se verifica **contra la auditoría del receptor y no contra la traza del agente**:
la traza la produce el agente, y el agente es lo que se está evaluando.

---

## 10. Instrumentación de la traza

La traza es un objeto `TrazaEjecucion` que valida contra
[`traza.schema.json`](../../../experiment/schemas/traza.schema.json) versión `1.0.0` **[existe]**.
Quién arma cada parte está en **[DP-09]**. Esta tabla dice qué emite B0 y cómo lo mide.

| Campo                                      | Dónde se mide o quién lo llena                                                                  | Reloj    | Detalle crítico                                                                                                       | Fuente                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `version_esquema`                          | Constante `VERSION_ESQUEMA_TRAZA` **[existe]**                                                  | —        | Cambiarla exige regenerar los tipos en el mismo commit                                                                | Decisión 21, RM-12      |
| `run_id`, `task_id`, `repetition`          | Ejecutor **[DP-09]**                                                                            | —        | El agente no debería conocer la tarea que resuelve                                                                    | HU-37                   |
| `condition`                                | Constante `B0` (`IDENTIDAD.arquitectura` **[existe]**)                                          | —        | Activa la regla `a2a.mensajes_totales = 0` del esquema                                                                | M4.5                    |
| `trace_id`                                 | Recibido en la cabecera `X-Trace-Id` y propagado a cada evento de auditoría                     | —        | En modo experimento B0 no lo inventa: sin él no hay correlación con la auditoría                                      | HU-33, F-5              |
| `provenance.state_hash_inicial`            | Huella que devuelve `RestablecerConocimientoUseCase` al ejecutor **[DP-09, DP-15]**             | —        | Formato `sha256:<64 hex>`. B0 no la calcula: la registra                                                              | M7.2, HU-36             |
| `provenance.modelo_id`, `model.*`          | Configuración de B0 ([sección 11](#11-configuración-y-límites))                                 | —        | Identificador exacto con snapshot, temperatura, `top_p`, `max_tokens`. `judge_model: null` (D7)                       | RNF-08                  |
| `provenance.llm_mode`, `cassette_path`     | `CaseteModelo`                                                                                  | —        | Excluidos de la comparación de reproducción                                                                           | HU-39, M7.3             |
| `timing.started_at`, `ended_at`            | `RelojMonotono`, lectura de pared aparte                                                        | Pared    | Solo para ordenar y auditar. **Ninguna duración se calcula con ellos**                                                | D6                      |
| `timing.total_ms`                          | `AtenderTurnoUseCase`: suma de `τ_fin − τ_inicio` de cada turno                                 | Monótono | Excluye el restablecimiento y la espera del turno de confirmación **[DP-11]**                                         | M4.1                    |
| `breakdown.llm_ms`                         | `ClienteModelo`: suma de los rtt de cada petición                                               | Monótono | Medido en el cliente que emite. En `replay` mide la lectura del casete, así que no es comparable con una corrida real | M4.2                    |
| `breakdown.tool_exec_ms`                   | `EjecutorCapacidad`: suma de `dur`, de la entrada del manejador a su salida                     | Monótono | Mismo código que en `mcp-server`, para que el componente se mida igual                                                | M4.2                    |
| `breakdown.transport_ms`                   | `TransporteHerramientasLocal`: suma de `rtt − dur` por llamada                                  | Monótono | Se mide aunque sea pequeño. Nunca se fija en cero por definición                                                      | M4.2, D5                |
| `breakdown.orchestration_ms`               | `InstrumentadorTrazas`: `total − llm − tool − transporte`                                       | Derivado | Se reporta sin corregir. Si es negativo, la ejecución es inválida **[DP-10]**                                         | M4.2, HU-MET-07         |
| `tool_calls[].seq`                         | `BucleAgente`, en orden de emisión, desde 1                                                     | —        | Incluye las llamadas rechazadas por validación y la rechazada por límite                                              | M2.4                    |
| `tool_calls[].nombre`, `args`              | `BucleAgente`: exactamente lo que emitió el modelo, antes de validar                            | —        | Normalizar los argumentos falsearía M2.3                                                                              | M2.1, M2.3              |
| `tool_calls[].isError`, `resultado_status` | `TransporteHerramientasLocal`                                                                   | —        | `ok` o el código de docs/02 §5                                                                                        | M2.3, M2.6              |
| `tool_calls[].resultado`                   | Resultado estructurado del caso de uso, antes de sanear                                         | —        | Es lo que M3.1 compara con la respuesta final                                                                         | M3.1                    |
| `tool_calls[].latency_ms`                  | rtt de la llamada                                                                               | Monótono | Excluido de la comparación de reproducción                                                                            | M7.3                    |
| `tool_calls[].agente`, `transporte`        | Constantes `b0-directo` y `directo` (`ProtocoloIntegracion` **[existe]**)                       | —        | —                                                                                                                     | —                       |
| `usage.input_tokens`, `output_tokens`      | `ClienteModelo`: suma de lo que reporta el proveedor                                            | —        | Obligatorios. `input_tokens ≥ 1`: sin consumo la traza es **inválida, no incompleta**                                 | HU-MET-01, M4.6         |
| `usage.cached_input_tokens`                | `ClienteModelo`: lo que reporta el proveedor, nunca omitido                                     | —        | Debe ser 0 en la corrida oficial                                                                                      | D2, RM-07               |
| `usage.llm_calls`                          | `ClienteModelo`: número de peticiones                                                           | —        | Mínimo 1                                                                                                              | M4.4                    |
| `usage.cost_usd_est`                       | **[DP-10]**                                                                                     | —        | Tokens por la tarifa congelada en la configuración                                                                    | M4.7                    |
| `a2a.mensajes_totales`                     | Constante 0                                                                                     | —        | El esquema lo exige para B0 y B1                                                                                      | M4.5                    |
| `conversation[]`                           | `RepositorioConversaciones`                                                                     | —        | Turnos de la persona y respuestas del agente, en orden                                                                | —                       |
| `server_audit[]`                           | Leído de `auditoria` por `trace_id`, nunca escrito por el agente **[DP-09]**                    | —        | Incluye `accion`, `resultado`, `motivo`, `token_valido`                                                               | M5.1, M5.2, M5.4        |
| `outcome.status`                           | `BucleAgente` e `InstrumentadorTrazas` ([sección 7](#7-diagrama-de-flujo-del-bucle-del-agente)) | —        | Lista cerrada de seis valores                                                                                         | docs/09 §13, M1.5       |
| `outcome.final_answer`, `final_json`       | `ExtractorObjetoFinal`                                                                          | —        | `null` si la ejecución no llegó a responder                                                                           | HU-30, M3.x **[DP-12]** |
| `outcome.confirmacion_solicitada`          | **[DP-21]**                                                                                     | —        | Definición operativa pendiente                                                                                        | M5.3                    |
| `outcome.confirmacion_otorgada`            | Ejecutor, porque sabe qué turno envió **[DP-09]**                                               | —        | Es lo que hizo la persona, no lo que aceptó el clasificador                                                           | M5.4                    |
| `outcome.tickets_creados`                  | Resultados de `crear_ticket_simulado` con `creado: true`                                        | —        | La verificación oficial sigue siendo la auditoría                                                                     | M5.4                    |
| `errors[]`                                 | Cualquier componente                                                                            | —        | Residuo negativo, objeto final ausente, excepciones                                                                   | —                       |

Reglas que esta instrumentación deja fijadas:

1. **Todas las duraciones se miden con reloj monótono**, nunca con reloj de pared (D6, RM-06). La
   hora de pared solo se guarda en `started_at` y `ended_at`, para ordenar y auditar.
2. **El tiempo de transporte se calcula restando la duración que el receptor reporta de sí mismo
   al tiempo de ida y vuelta que observa el emisor**, nunca restando marcas de tiempo de procesos
   distintos (D5, RM-05). En B0 emisor y receptor comparten proceso, pero se aplica la misma resta
   para que el método sea idéntico al de B1.
3. **Un residuo de orquestación negativo invalida la ejecución**: indica un defecto de
   instrumentación (M4.2, HU-MET-07). B0 no lo corrige **[DP-10]**.
4. **Una ejecución sin consumo de tokens registrado es inválida, no incompleta** (HU-MET-01,
   HU-34). El esquema lo impone con `input_tokens ≥ 1` y `llm_calls ≥ 1`.
5. **Sin paralelismo dentro de una ejecución** (D1, RM-04). La descomposición de la latencia solo
   es aditiva si las llamadas ocurren en secuencia. Si el modelo pide varias herramientas en una
   misma respuesta, `BucleAgente` las ejecuta una a una, en el orden emitido.
6. **Caché de contexto deshabilitada** (D2, RM-07). `ClienteModelo` no la solicita y no hay
   variable de entorno para activarla. `cached_input_tokens` se registra siempre.
7. **La verificación de escrituras no autorizadas se hace contra el registro de auditoría del
   receptor, no contra la traza del agente** (M5.1), porque la traza la produce el agente y el
   agente es lo que se está evaluando. Por eso `server_audit[]` se lee de la tabla y no se arma
   con lo que el bucle cree que pasó **[DP-09]**.
8. **B0 no calcula métricas** (RM-02, decisión 19). Emite duraciones, conteos y resultados; todo
   cálculo sobre ellos vive en `experiment/analisis/`.

---

## 11. Configuración y límites

Las variables que ya existen conservan su nombre. Las nuevas usan el prefijo `UNIHELP_`, como
`UNIHELP_PERFIL` y `UNIHELP_VERSION`. Una variable obligatoria que falta o no es válida hace
**fallar el arranque**: nunca se ejecuta con un valor supuesto (mismo criterio que
`resolverConfiguracionConocimiento` **[existe]**). No existe hoy un archivo único con estos
valores **[DP-18]**.

| Variable                              | Estado               | Por defecto                    | Si falta                                                                             | Uso y fuente                                                                                                                                                         |
| ------------------------------------- | -------------------- | ------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                | **[existe]**         | `3000`                         | Usa el valor por defecto                                                             | `main.ts`, docs/arquitecturas.md                                                                                                                                     |
| `CORS_ORIGEN`                         | **[existe]**         | `*`                            | Usa el valor por defecto                                                             | `main.ts`                                                                                                                                                            |
| `UNIHELP_VERSION`                     | **[existe]**         | `0.1.0` (Compose)              | Usa el valor por defecto                                                             | `docker-compose.yml`                                                                                                                                                 |
| `CONOCIMIENTO_DATABASE_URL`           | **[existe]**         | —                              | Falla al arrancar (`ConfiguracionInvalidaError`)                                     | `ConocimientoModule.forRoot()`                                                                                                                                       |
| `CONOCIMIENTO_UMBRAL_RELEVANCIA`      | **[existe]**         | `0.05`                         | Usa el valor por defecto                                                             | Decisión 17                                                                                                                                                          |
| `UNIHELP_PERFIL`                      | **[existe]**         | —                              | El restablecimiento no se registra                                                   | HU-36. En B0 nunca debería ser necesario: restablece el ejecutor                                                                                                     |
| `TICKETS_DATABASE_URL`                | **[a crear]**        | —                              | Falla al arrancar                                                                    | Esquemas `tickets` y `auditoria` **[DP-07]**                                                                                                                         |
| `UNIHELP_MODELO_PROVEEDOR`            | **[a crear]**        | —                              | Falla al arrancar                                                                    | RNF-01. El proveedor no está elegido **[DP-18]**                                                                                                                     |
| `UNIHELP_MODELO_ID`                   | **[a crear]**        | —                              | Falla al arrancar                                                                    | Identificador **exacto con fecha de snapshot**. Va a `provenance.modelo_id` y `model.id` en cada traza (RNF-08)                                                      |
| `UNIHELP_MODELOS_PERMITIDOS`          | **[existe]**         | solo el de `UNIHELP_MODELO_ID` | Usa el valor por defecto                                                             | Modelos, separados por coma, entre los que la pantalla de Configuración puede elegir (decisión 27). Las corridas usan siempre `UNIHELP_MODELO_ID`                    |
| `UNIHELP_MODELO_TEMPERATURA`          | **[a crear]**        | `0.2`                          | Usa el valor por defecto y lo registra                                               | docs/07 §2 (su justificación requiere ADR). Va a `model.temperature`                                                                                                 |
| `UNIHELP_MODELO_ESFUERZO`             | **[existe]**         | `none`                         | Usa el valor por defecto; un valor fuera de `none/low/medium/high` falla al arrancar | Esfuerzo de razonamiento (decisión 40). Con GPT-5.x solo `none` admite `temperature` y herramientas en Chat Completions; con otro valor entra en la clave del casete |
| `UNIHELP_MODELO_TOP_P`                | **[a crear]**        | `1.0`                          | Usa el valor por defecto y lo registra                                               | docs/07 §2. Va a `model.top_p`                                                                                                                                       |
| `UNIHELP_MODELO_MAX_TOKENS`           | **[a crear]**        | `2048`                         | Usa el valor por defecto y lo registra                                               | docs/07 §2. Va a `model.max_tokens`                                                                                                                                  |
| Credencial del proveedor              | **[a crear]**        | —                              | Falla al arrancar en `live` y `record`. No se exige en `replay`                      | Nunca se versiona (regla 9). HU-44: la réplica no requiere credenciales                                                                                              |
| `UNIHELP_LIMITE_TIEMPO_MS`            | **[a crear]**        | `120000`                       | Usa el valor por defecto. Un valor no positivo hace fallar el arranque               | RNF-04, `timeout_s: 120` en las 40 tareas                                                                                                                            |
| `UNIHELP_LIMITE_TURNOS_AGENTE`        | **[a crear]**        | `8`                            | Ídem                                                                                 | RNF-04, HU-04, `max_turnos_agente: 8` **[DP-08]**                                                                                                                    |
| `UNIHELP_LIMITE_LLAMADAS_HERRAMIENTA` | **[a crear]**        | `20`                           | Ídem                                                                                 | RNF-04, docs/02 §5 (`LIMITE_EXCEDIDO`)                                                                                                                               |
| `UNIHELP_MODO_LLM`                    | **[a crear]**        | —                              | Falla al arrancar                                                                    | `record`, `replay` o `live` (HU-39). Sin valor por defecto: un `live` implícito gasta presupuesto y un `replay` implícito oculta que faltan casetes                  |
| `UNIHELP_DIRECTORIO_CASETES`          | **[a crear]**        | —                              | Falla al arrancar en `record` y `replay`                                             | HU-39. Va a `provenance.cassette_path`                                                                                                                               |
| `UNIHELP_DIRECTORIO_CORRIDA`          | **[a crear, DP-09]** | —                              | Falla al arrancar si B0 persiste la traza                                            | `TrazasModule.registrar({ directorioCorrida })` **[existe]**                                                                                                         |

Lo que deliberadamente **no** es configurable:

- **La caché de contexto.** No hay variable: está deshabilitada siempre (D2, RM-07).
- **El paralelismo de herramientas.** No hay variable: siempre en secuencia (D1, RM-04).
- **La tabla de prioridad y el clasificador de afirmación.** Son código versionado, no
  configuración (RNF-02).

El identificador exacto del modelo y los parámetros de muestreo **quedan registrados en cada
traza** (`provenance.modelo_id`, `model.provider`, `model.id`, `model.snapshot`,
`model.temperature`, `model.top_p`, `model.max_tokens`), aunque vengan de un valor por defecto.
Una traza que no los traiga no permite citar la ejecución (RNF-08).

---

## 12. Qué NO hace B0

Esta sección es tan vinculante como las demás. **Cada elemento que se agregue de esta lista
cambia lo que significa la comparación con B1.**

| B0 no...                                              | Por qué                                                                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Descubre capacidades dinámicamente                    | Su lista de herramientas es fija y compilada. Descubrirlas en ejecución es lo que aporta MCP (`tools/list` con `listChanged`), y es justo lo que M6.1 a M6.5 comparan en la semana 8 (HU-27, HU-43).               |
| Coordina con otros agentes                            | Es un agente único. `a2a.mensajes_totales` es cero por definición y el esquema lo exige (M4.5). Descomponer la tarea es lo que miden B2 y B3 (H2).                                                                 |
| Tiene separación de privilegios                       | Un solo agente tiene acceso a las cinco herramientas. La separación es de B2 y B3 (HU-20). M5.6 se declara «no aplica» en B0, nunca como cero.                                                                     |
| Expone interfaz gráfica propia                        | Solo sirve la API de `libs/contratos` al frontend único `apps/web` (decisión 13). docs/08 §20 deja la interfaz gráfica fuera del alcance del experimento.                                                          |
| Clasifica antes de consultar al modelo                | HU-02 y F-1: la clasificación se infiere del comportamiento. Un preprocesador sería un delta de prompt mayor que el que admite RNF-01 y haría que M3.6 midiera el preprocesador ([sección 1](#1-qué-es-b0)).       |
| Inyecta la base de conocimiento completa en el prompt | Las políticas llegan solo por `buscar_politica`, hasta tres por consulta (HU-05, HU-08). Con la base en el prompt, M2.1 y M3.1 no tendrían sobre qué medirse, y los tokens dejarían de ser comparables (M4.6, D2). |
| Decide la prioridad del ticket                        | La dicta la tabla institucional (HU-11, F-3) **[DP-02]**.                                                                                                                                                          |
| Valida por sí mismo el token de confirmación          | Lo valida `CrearTicketUseCase`, código compartido con B1. Si el bucle de B0 tuviera su propia validación, la garantía de H4 dependería de la arquitectura (HU-16).                                                 |
| Restablece el estado ni calcula la huella             | Lo hace el ejecutor antes de cada ejecución (HU-36). B0 solo registra la huella recibida.                                                                                                                          |
| Calcula métricas                                      | RM-02, decisión 19: todo cálculo vive en el cuaderno de Python.                                                                                                                                                    |
| Ejecuta herramientas en paralelo                      | D1, RM-04.                                                                                                                                                                                                         |
| Usa búsqueda semántica o embeddings                   | RM-01, HU-08, decisión 17.                                                                                                                                                                                         |

---

## Estado de la implementación

Lo que existe hoy frente a lo diseñado en las secciones anteriores:

| Pieza del diseño                                    | Implementación                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clases de B0 (sección 4.1)                          | Movidas a `libs/agente-nucleo/src/lib/` (`conversacion/`, `agente/`, `modelo/`, `tickets/`, `consultas/`, `experimento/`, `http/`, `catalogo/`, `configuracion/`) y publicadas por `AgenteNucleoModule.forRoot`. `RegistroCapacidades`, los adaptadores (ahora `*.capacidad.ts`) y `TransporteHerramientasLocal` (ahora `CapacidadesLocales`, la implementación en proceso de `PuertoCapacidades`) están en `libs/capacidades`. En `apps/b0-directo/src/app/` quedan `salud/` y el `AppModule` que enlaza `PUERTO_CAPACIDADES` con `CapacidadesLocales` (decisión 41). El bucle pide las capacidades al puerto antes de cada llamada al modelo y la traducción a function calling está en `aFunctionCalling`, único lugar para B0 y B1. |
| `ACTOR_AGENTE_B0`, etiquetas `b0-directo`/`directo` | Ya no son constantes: salen de `IdentidadAgente`, derivada de `IDENTIDAD` de salud (`actor` = `b0-agent`, `agente` = `b0-directo`, `transporte` = `directo`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Resultado de las herramientas                       | Se normaliza como si hubiera viajado por la red (fechas ISO) también en B0, para que traza y respuesta tengan la misma forma que en B1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `@unihelp/herramientas` y `@unihelp/tickets`        | Creadas en `libs/` (decisión 26, provisional). `@unihelp/herramientas` declara además `PuertoCapacidades` y `ErrorInfraestructura` (decisión 41).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Cinco herramientas                                  | Las de docs/02 con tres ajustes (DP-01 resuelta, decisión 24).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Prioridad                                           | El modelo la escribe y `ProponerTicketUseCase` la verifica (DP-02 resuelta, decisión 25).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Modelo                                              | OpenAI `gpt-5.4-mini-2026-03-17`, temperatura 0.2 (decisión 23).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Confirmación por turno real                         | Implementada con la opción 1 de DP-05 (provisional, decisión 26).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Flujo del frontend                                  | Opción (a) de DP-06: el botón emite el token por los mismos casos de uso.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Instrumentación                                     | `InstrumentadorTrazas` acumula tiempos, tokens, llamadas, objeto final y motivo de corte por ejecución. No arma ni persiste la traza: la entrega por `GET /experimento/trazas/:traceId` y el ejecutor la completa (decisión 32).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Rutas del ejecutor                                  | `ExperimentoController` **[existe]**: `POST /experimento/restablecer` y `GET /experimento/trazas/:traceId`, solo con `UNIHELP_PERFIL=experimento` (decisión 32).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Límite de turnos                                    | 8 turnos de la persona por conversación, con `429 limite-turnos` del contrato (DP-08 sigue abierta para el ejecutor).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Casetes                                             | `CaseteModelo` con `live`, `record` y `replay`. DP-04 sigue abierta.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Restablecimiento de tickets (DP-15)                 | `RestablecerTicketsUseCase` de `@unihelp/tickets` **[existe]**: vacía el esquema `tickets` entre ejecuciones y nunca la auditoría (decisión 31). La huella sigue cubriendo solo `conocimiento`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Docker (`pnpm b0`)                                  | No funciona todavía: falta migrar la base dentro del profile y pasar las variables del modelo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Hallazgo nuevo, **DP-22 (pendiente)**: OpenAI cachea automáticamente los prompts largos y
no permite desactivarlo. D2 (RM-07) no se puede cumplir con este proveedor; B0 registra
`cached_input_tokens` para que el análisis vea el efecto (decisión 23).

Comportamientos observados en las primeras pruebas manuales (datos para el piloto, no
defectos que corregir en el código):

- En T-COM-004 el modelo citó a veces `POL-MA-001`, que es la distractora prohibida.
- Antes de ajustar el prompt, el modelo intentó confirmar con un identificador
  inventado y con un «sí» anterior a la propuesta. La garantía mecánica rechazó
  ambos intentos y los dejó auditados.

---

## 13. Decisiones pendientes

Cada entrada es una contradicción o un vacío entre el encargo de este documento, el anexo y el
repositorio. Ninguna está resuelta. Las que afectan lo que significan las cifras caen bajo
RM-17: se deciden en equipo y se registran en `docs/decisiones-tecnicas.md`, con su razón y su
consecuencia. Si la decisión contradice al anexo, también se agrega una fila a la tabla de
discrepancias de `AGENTS.md` §9.

### DP-01. La quinta herramienta: `confirmar_propuesta` o reporte agregado

- **Contradicción.** El encargo pide cinco herramientas: búsqueda, estado, propuesta, creación y
  reporte agregado. docs/02 define otras cinco: las cuatro primeras más `confirmar_propuesta`. El
  reporte existe solo como ruta REST (docs/01 §5, F-6). Las 40 tareas usan exactamente las cinco
  de docs/02: `confirmar_propuesta` es obligatoria en 38 y prohibida en las 10 adversariales.
  Ninguna tarea menciona un reporte. HU-25 dice «las cinco herramientas».
- **Opciones.**
  1. _Las cinco de docs/02._ El reporte no es herramienta. T-ADV-008 («ofrece información
     agregada») se resuelve con texto.
  2. _Reemplazar `confirmar_propuesta` por el reporte._ El token tendría que emitirse fuera de las
     herramientas, por ejemplo en el controlador al llegar el turno de la persona. Exige regenerar
     las 40 tareas desde `tareas_data.py` (regla 12) y cambia los denominadores de M2.1, M2.2 y
     M2.4.
  3. _Seis herramientas._ Choca con HU-25 y con la numeración de la herramienta sellada, que el
     anexo llama «5.ª» (docs/02, docs/06) y «sexta» (docs/09 §10).
- **Qué está en juego.** Que las tareas y la traza hablen de las mismas herramientas, M2.1 a
  M2.6, y cuál es el mecanismo que emite el token (H4).

### DP-02. Quién fija la prioridad y dónde vive la tabla

- **Contradicción.** HU-11 y F-3 dicen que la prioridad sale de la tabla y no del criterio del
  modelo. Pero docs/02 recibe `prioridad` como argumento que escribe el modelo, las tareas la
  verifican como argumento (`args_parciales.prioridad: P2`), M3.5 mide si «el sistema aplica la
  regla institucional en vez de improvisar», y docs/02 §2.2 dice que la tabla debe ser
  «computable por el agente». La decisión 8 y el README de `libs/conocimiento` dicen que priorizar
  «vive en cada arquitectura», pero una tabla distinta por arquitectura rompería RNF-02.
  `libs/dominio` no tiene tabla de prioridad.
- **Opciones.**
  1. _El modelo la escribe y el código la verifica._ `ProponerTicketUseCase` rechaza con
     `VALIDACION_ENTRADA` una prioridad distinta de la tabla. El ticket nunca queda con otra
     prioridad (HU-11), M3.5 y M2.3 siguen midiendo al modelo, y el esquema de docs/02 no cambia.
  2. _El código la calcula e ignora el argumento._ HU-11 se cumple de forma literal, pero M3.5
     pasa a ser casi constante y `args_parciales.prioridad` deja de significar algo.
  3. _El modelo la escribe y nadie la verifica_, como en docs/02 literal. HU-11 queda sin
     garantía.
- **Vacíos de la tabla que hay que cerrar en cualquier opción.**
  - Combinaciones sin fila: `FUERA_DE_SERVICIO` total con nivel medio, `DEGRADADO` total con
    nivel alto o medio.
  - El alcance `individual` no lo publica el servicio: es una conclusión del diagnóstico. Por
    eso la tabla no es computable solo con datos de la base.
  - La escala `P1` a `P4` no coincide con `PRIORIDADES` de `libs/dominio` (`critica`, `alta`,
    `media`, `baja`).
- **Dónde vive la tabla**: `libs/dominio` como dato, `@unihelp/tickets`, o cada arquitectura. Si
  es compartida, la decisión 8 necesita una aclaración.
- **Qué está en juego.** M3.5, M2.3, HU-11 y la coherencia con la decisión 8.

### DP-03. Diferencias entre los contratos de docs/02, `libs/conocimiento` y `libs/dominio`

- **Contradicción.** Los esquemas de docs/02 no coinciden con lo que ya existe:
  - Estado: `FUERA_DE_SERVICIO` frente a `interrumpido`. La decisión 16 fija la equivalencia,
    pero no qué vocabulario publica la herramienta.
  - Alcance: `individual` frente a `programado` o `null`.
  - `mensaje` obligatorio frente a anulable; ventana frente a `eta_restablecimiento`.
  - `incluir_historial` sin fuente.
  - `max_resultados` hasta 5 frente al límite fijo de 3.
  - `total_encontrados` no expuesto; sin campo para el motivo de ausencia que pide HU-07.
  - Clasificación: `fuera_de_alcance` y `adversarial` en las tareas, `fuera-de-alcance` y sin
    `adversarial` en `TIPOS_CLASIFICACION`.
  - Categorías de ticket sin catálogo.
  - Origen de `solicitante` en B0, que no tiene autenticación (docs/08 §20).
- **Opciones.** (a) La herramienta publica el vocabulario de docs/02 y las tareas, y se traduce
  al de `libs/dominio` en el borde del DTO. (b) La herramienta publica el vocabulario de
  `libs/dominio`, y se regeneran las tareas y se ajusta docs/02.
- **Qué está en juego.** Es el contrato que B1 publicará. Cualquier ajuste posterior cambia el
  prompt de ambas arquitecturas y exige actualizar la instantánea de contrato (RM-12).

### DP-04. Marcador de delimitación: fijo, derivado del `trace_id` o de otra fuente

- **Contradicción.** docs/02 §2.1 fija un marcador público (`<documento ...>`). El encargo pide
  uno derivado del `trace_id` y distinto en cada ejecución. Pero la clave del casete incluye los
  mensajes (docs/05 §4) y el `trace_id` cambia entre grabación y reproducción (M7.3 lo excluye),
  así que un marcador derivado del `trace_id` rompe la reproducción (HU-39, M7.3 = 1). Además,
  si el formato del `trace_id` es predecible, el marcador también lo es.
- **Opciones.**
  1. Derivarlo de una identidad estable entre grabación y reproducción (tarea, arquitectura,
     repetición y semilla). Es reproducible, pero predecible para quien conozca el esquema.
  2. Derivarlo del `trace_id` y normalizar el marcador al calcular la clave del casete.
  3. Derivarlo con un secreto por corrida guardado junto al casete.
  4. Marcador fijo de docs/02, que el contenido puede cerrar.
- **Qué está en juego.** M7.3, la fuerza de la capa 2 y que B0 y B1 envíen al modelo
  exactamente los mismos bytes.

### DP-05. Cómo se verifica que la confirmación viene de un turno real

- **Contradicción.** En docs/02 el modelo escribe `texto_confirmacion` y nada comprueba que la
  persona lo haya escrito. T-ADV-007 lo prohíbe expresamente. Si solo B0 lo comprobara (porque
  tiene la conversación en el mismo proceso), la garantía de H4 sería distinta en B1, cuyo
  `mcp-server` no ve la conversación.
- **Opciones.**
  1. El controlador de entrada de **cada** arquitectura registra el turno literal en una tabla
     `tickets.turnos_usuario` por `trace_id`, antes de que el modelo lo vea, y
     `ConfirmarPropuestaUseCase` exige que el texto coincida con un turno posterior a la
     propuesta. Es simétrico entre B0 y B1.
  2. Confiar en el modelo, como en docs/02 literal. La emisión del token se vuelve
     probabilística.
  3. El controlador emite el token al recibir el turno, sin herramienta (ligado a DP-01,
     opción 2).
- **Qué está en juego.** El significado de M5.1 y de H4, y la simetría entre B0 y B1.

### DP-06. Flujo de tickets del frontend frente al flujo del experimento

- **Contradicción.** En `libs/contratos`, el cliente pide la propuesta
  (`POST /api/tickets/propuestas` a partir del `conversacionId`) y crea el ticket con
  `POST .../confirmacion` y `confirmacionExplicita: true`, sin token ni modelo (decisión 13). En
  el experimento, el modelo propone, confirma y crea con herramientas, y la confirmación es un
  turno de conversación (docs/01 F-4, las tareas).
- **Opciones.** (a) Ambos flujos conviven sobre los mismos casos de uso: la ruta de confirmación
  emite el token internamente a partir de la acción explícita. (b) La ruta del frontend queda
  fuera de la corrida y se documenta así. (c) Se ajusta el contrato, lo que según la regla 5
  afecta a las siete apps.
- **Qué está en juego.** La regla 5 de `AGENTS.md` y que la garantía de HU-16 sea una sola.

### DP-07. Dónde vive el código que B0 y `mcp-server` deben compartir — **RESUELTA (decisiones 26 y 41)**

> Casos de uso en `@unihelp/tickets` y `@unihelp/conocimiento`; esquemas, validador, saneador,
> detector y `EjecutorCapacidad` en `@unihelp/herramientas`; la lógica de las cinco capacidades y
> el invocador del receptor en `@unihelp/capacidades`; el núcleo del agente en
> `@unihelp/agente-nucleo`. B0 y `mcp-server` ejecutan el mismo código.

- **Vacío.** Casos de uso de tickets, confirmación, auditoría y reporte; esquemas de
  herramientas; validador; saneador; detector; y `EjecutorCapacidad`. Nada de eso existe.
  `libs/contratos` no admite dependencias de runtime (regla 4), así que AJV no puede ir ahí.
- **Opciones.** Librerías nuevas `@unihelp/tickets` y `@unihelp/herramientas` (nombres
  propuestos), con tags `arq:compartido` y `alcance:backend`. O extender `libs/conocimiento`, o
  poner solo los esquemas en `libs/contratos`.
- **Qué está en juego.** RNF-01: si B0 y B1 no ejecutan el mismo código de capacidad, validación
  y saneamiento, `B1 − B0` mide también esas diferencias.

### DP-08. El límite de turnos de agente

- **Vacío.** RNF-04 y las tareas fijan 8 turnos de agente, pero no definen «turno de agente»:
  ¿cada petición al modelo, o cada respuesta a la persona? Con dos turnos de la persona por tarea
  como máximo, la segunda lectura nunca corta. Además la traza no tiene status para este corte:
  solo `timeout` y `limite_herramientas`. El contrato sí tiene `limite-turnos` (429) para la
  conversación.
- **Opciones.** (a) Definirlo como peticiones al modelo y registrarlo como
  `limite_herramientas`. (b) Agregar un status nuevo: sube `version_esquema`, regenera tipos y
  actualiza `estados_finales` (RM-12, HU-MET-01). (c) Registrarlo como `error_agente`.
- **Qué está en juego.** M1.5 (fallos por tipo) y los denominadores de efectividad y latencia.

### DP-09. Quién arma y persiste la traza — **RESUELTA (decisión 32)**

> **Se eligió la opción 2.** B0 entrega su segmento por
> `GET /experimento/trazas/:traceId` (`TrazaParcialDto` de
> [`libs/contratos`](../../../libs/contratos/src/lib/experimento.contrato.ts)) y el
> ejecutor de `experiment/ejecutor/` completa la identidad de la ejecución, arma la
> traza, la valida contra el esquema y la persiste; la inválida va a `cuarentena/`.
> El restablecimiento y su huella se piden por `POST /experimento/restablecer`.
> Ambas rutas viven fuera del prefijo `/api` y solo existen con
> `UNIHELP_PERFIL=experimento`. `server_audit[]` sigue leyéndose de la auditoría y
> no del agente, de modo que M5.1 conserva su fuente independiente. La decisión 21
> queda acotada: `libs/trazas` sigue siendo el validador de TypeScript, pero en el
> camino de la corrida quien valida es el ejecutor, con el mismo esquema.
>
> Lo que sigue abierto: B0 tampoco persiste la traza por su cuenta, así que
> `UNIHELP_DIRECTORIO_CORRIDA` no hace falta y DP-11 (qué entra en `total_ms`)
> continúa sin resolver.

- **Vacío.** La traza necesita datos que B0 no tiene o no debería tener:
  - la identidad de la tarea (`task_id`, `repetition`, `run_id`), que el agente no debería
    conocer;
  - la huella del restablecimiento, que la produce el ejecutor;
  - `server_audit[]`, que debe leerse de la auditoría y no del agente;
  - `confirmacion_otorgada`, que la sabe quien envió el turno;
  - la señal de fin de la ejecución: B0 no sabe si llegará otro turno.

  La decisión 21 dice que la traza la escribe TypeScript, mientras que el ejecutor de docs/05 es
  Python.

- **Opciones.**
  1. B0 arma y persiste todo, recibiendo la identidad por cabeceras y leyendo la auditoría.
     Es simple, pero el agente evaluado lee la fuente de su propia verificación.
  2. B0 devuelve su segmento (tiempos, consumo, llamadas, resultado) y el ejecutor completa y
     persiste. Exige transportar el segmento, y cualquier ampliación del contrato alcanza a las
     siete apps (regla 5).
  3. Un componente TypeScript del ejecutor, fuera de B0, arma y persiste con `libs/trazas`.
- **Qué está en juego.** La independencia de M5.1, que el agente no conozca la tarea, y
  `total_ms` (DP-11).

### DP-10. Aritmética de instrumentación en TypeScript

- **Contradicción.** El esquema exige `orchestration_ms` (residuo reportado) y `cost_usd_est`.
  La decisión 19 y RM-02 prohíben calcular métricas fuera de Python, y la decisión 21 evitó
  a propósito la aritmética del residuo en TypeScript. HU-MET-07 pide validar el residuo «en cada
  ejecución», y `AGENTS.md` §9 ya anota que hoy corre en la carga de Python.
- **Opciones.**
  1. B0 reporta el residuo y el costo como datos de instrumentación. El cuaderno los recalcula y
     no confía en ellos. Un residuo negativo no se corrige, y el esquema lo aparta como
     `esquema_invalido`.
  2. Cambiar el esquema para que esos campos los llene el análisis.
  3. Que los llene el ejecutor.
- **Qué está en juego.** RM-02, M4.2, M4.7 y HU-MET-07.

### DP-11. Dónde se mide `timing.total_ms`

- **Contradicción.** M4.1 dice «medido con reloj monótono en el ejecutor». Medido dentro de B0,
  como suma de turnos, deja fuera la entrada HTTP y excluye naturalmente la espera de
  confirmación. Medido en el ejecutor, incluye la entrada HTTP, que no está en ningún componente
  de la descomposición y engordaría el residuo.
- **Opciones.** (a) En el ejecutor, restando la espera. (b) En el agente, como suma de turnos.
  (c) Ambos, uno como control del otro.
- **Qué está en juego.** M4.1, M4.2 y la comparabilidad de latencia entre arquitecturas.

### DP-12. Origen de la clasificación en B0

- **Contradicción.** HU-02 y F-1 dicen que en B0 y B1 la clasificación «se infiere de las
  herramientas invocadas». HU-30 y docs/03 §4.3 dicen que el agente único «emite el mismo objeto»
  que el orquestador, y ese objeto trae `clasificacion`, que es lo que lee M3.6. Además,
  `ClasificacionDto` exige `confianza`, que ninguna fuente produce.
- **Opciones.** (a) El modelo la escribe en el objeto final. Es explícita, no inferida, y reduce
  la asimetría que M3.6 declara. (b) Una regla de código la infiere de `tool_calls[]` al cerrar.
  Esa regla sería lógica de triaje y tendría que ser idéntica en B1. (c) Registrar ambas.
- **Qué está en juego.** M3.6 y la lectura de HU-02.

### DP-13. Entrada de menos de 10 caracteres

- **Contradicción.** HU-01 pide «una petición de aclaración, no un error técnico».
  `EnviarMensajeDto` fija 10 a 2000 caracteres, y el contrato devuelve `400 validacion`.
- **Qué está en juego.** El contrato del frontend (regla 5). No afecta a las tareas, que
  cumplen el rango.

### DP-14. B0 en proceso frente a B0 por HTTP

- **Contradicción.** El anexo define B0 como un adaptador HTTP hacia `unihelp-api` (docs/01 §1),
  y el microbenchmark mide «llamada HTTP directa a la API» (docs/05 §5). El repositorio y el
  encargo lo definen en proceso (docs/arquitecturas.md), y `unihelp-api` no existe (`AGENTS.md`
  §9).
- **Qué está en juego.** La fila B0 de la Tabla 1 (M4.3) mediría una llamada a método, y el
  `transport_ms` de B0 será casi cero. Es coherente con el encargo, pero cambia lo que el
  artículo puede afirmar sobre el costo de MCP frente a HTTP.

### DP-15. Restablecimiento de tickets y huella del estado — **RESUELTA A MEDIAS (decisión 31)**

> **El restablecimiento existe; la huella no.** `RestablecerTicketsUseCase` vacía
> las cuatro tablas del esquema `tickets` y reinicia la secuencia antes de cada
> ejecución, y **nunca** toca `auditoria`, que es la fuente independiente de M5.1
> (HU-35, RM-09). Con eso ninguna ejecución ve propuestas ni tickets de la
> anterior, que era lo que rompía RNF-03.
>
> **Sigue abierto** lo que la huella cubre: `provenance.state_hash_inicial` sigue
> siendo solo la del esquema `conocimiento`. Las opciones (a) y (b) de abajo
> continúan vigentes, y con ellas los 60 tickets históricos de docs/01 §7, que
> tampoco existen.

- **Vacío.** La huella actual cubre solo el esquema `conocimiento`. RNF-03 y HU-24 exigen que los
  tickets también partan de un estado conocido, y docs/01 §7 prevé 60 tickets históricos. La
  auditoría, en cambio, no debe restablecerse.
- **Opciones.** (a) Ampliar la huella al esquema `tickets`. Cambian las 20 huellas esperadas
  (decisiones 17 y 18). (b) Una segunda huella, lo que cambia el esquema de la traza.
- **Qué está en juego.** M7.2 y HU-24.

### DP-16. Cliente del modelo y casetes: por arquitectura o compartidos — **RESUELTA (decisión 41)**

> Opción (a): `ClienteModelo` y `CaseteModelo` viven en `@unihelp/agente-nucleo` y son el mismo
> código en B0 y B1.

- **Vacío.** RNF-01 exige el mismo modelo y los mismos parámetros. Si cada arquitectura escribe
  su propio cliente, `llm_ms` puede diferir por la sobrecarga del cliente y no por la
  arquitectura. El cliente no es parte de la variable medida.
- **Opciones.** (a) Librería compartida, por ejemplo `@unihelp/modelo`. (b) Una copia por
  arquitectura, con una prueba de equivalencia.
- **Qué está en juego.** M4.2 y M7.3.

### DP-17. Status de los fallos de dependencia

- **Vacío.** No está fijado qué status lleva una ejecución si la base de datos cae
  (`SERVICIO_NO_DISPONIBLE`), si el proveedor responde con límite de tasa, o si en `replay` falta
  una clave del casete. docs/09 §13 dice que la «caída de un servicio» es `error_infraestructura`
  y se reejecuta, pero en B1 el modelo recibiría el error y podría seguir.
- **Qué está en juego.** RM-15: confundir un fallo de infraestructura con uno de la arquitectura
  infla o desinfla los resultados.

### DP-18. Proveedor, modelo y archivo único de configuración

- **Vacío.** docs/00 §6 (pregunta 4) exige fijar el modelo y su snapshot en
  `experiment.config.yaml`, que no existe. Sin ese archivo, las variables de la sección 11 no
  tienen fuente única, y nada garantiza que B0 y B1 usen los mismos valores.
- **Qué está en juego.** RNF-01, RNF-08 y el `config_hash` de la procedencia.

### DP-19. Campo de advertencia en la salida de las herramientas de lectura

- **Vacío.** La capa 3 necesita que la salida de `buscar_politica` y de
  `consultar_estado_servicio` lleve la advertencia del detector. Los esquemas de salida de
  docs/02 no tienen ese campo.
- **Opciones.** (a) Agregar un campo opcional de advertencia, lo que cambia el contrato de ambas
  herramientas (RM-12). (b) Llevar la advertencia dentro del bloque delimitado. (c) No tener
  detector y dejar solo las capas 1, 2 y 4.
- **Qué está en juego.** HU-18 criterio 2 y M5.5 en el vector de inyección indirecta.

### DP-20. ¿`proponer_ticket` es de lectura o de escritura?

- **Contradicción.** docs/02 la anota `readOnlyHint: true`, y HU-13 dice que «la propuesta no
  produce ningún efecto sobre los datos». Pero registra una propuesta con vencimiento (docs/01
  §4.4), y las tareas la cuentan entre «las tres de escritura», prohibidas en todas las
  adversariales.
- **Qué está en juego.** La rama del bucle, si deja evento de auditoría como escritura (RM-09,
  RN-07) y la anotación que publicará B1 (HU-26).

### DP-21. Definición operativa de «el agente pidió confirmación»

- **Vacío.** El ejecutor envía el turno de confirmación solo si `agente_pidio_confirmacion`, y
  M5.3 lee `outcome.confirmacion_solicitada`. Ninguno de los dos define cómo se decide.
- **Opciones.** (a) Regla mecánica: el turno terminó con una propuesta pendiente y
  `listo_para_confirmar`, sin intento de creación en ese turno. Es idéntica en todas las
  arquitecturas. (b) Autodeclaración del modelo en el objeto final
  (`confirmacion.solicitada`), que es un dato del evaluado sobre sí mismo. (c) Juicio del juez
  sobre el texto.
- **Qué está en juego.** M5.3 y que el ejecutor envíe o no el segundo turno, lo que cambia el
  resultado de todas las tareas compuestas.

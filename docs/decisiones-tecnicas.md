# Decisiones tecnicas de la inicializacion

Registro de las decisiones tomadas al montar el esqueleto del monorepo, con su
justificacion. Sirve para sustentar el capitulo de implementacion del trabajo de
grado y para que un tercero entienda por que el repositorio esta armado asi.

## 1. La raiz del repositorio ES el monorepo

La estructura pedida mostraba una carpeta `unihelp/` conteniendo todo. El
repositorio clonado ya se llama asi, de modo que `apps/`, `libs/`, `experiment/`,
`infra/` y `docs/` viven en la raiz y no en un nivel anidado redundante. Al
clonar, la raiz del clon es el workspace.

## 2. Layout `apps/` + `libs/` con alias, en lugar del layout de paquetes

Nx 23 ofrece dos organizaciones: la clasica (`apps/` + `libs/` con alias de
TypeScript) y la nueva "TS solution" (`packages/` con un `package.json` por
proyecto y project references).

Se eligio la **clasica** porque:

- Coincide con la estructura pedida.
- El modelo mental es mas simple: `@unihelp/dominio` es un alias en
  `tsconfig.base.json`, no un paquete con su propio ciclo de vida.
- Los Dockerfiles quedan mas directos, sin necesidad de resolver referencias
  entre paquetes del workspace dentro de la imagen.

Para un trabajo reproducible por terceros, la simplicidad de lectura pesa mas
que las ventajas de las project references.

## 3. Un solo `node_modules` en desarrollo, dependencias aisladas en la imagen

El requisito de "no mezclar dependencias de las otras tres" se cumple **donde se
evalua**: en la imagen de contenedor.

- **En desarrollo** el workspace comparte un `node_modules` en la raiz. Asi
  funciona un monorepo Nx con pnpm, y es deseable: mantiene una sola version de
  NestJS y de Angular para las cuatro arquitecturas. Si cada arquitectura usara
  versiones distintas del framework, las diferencias medidas ya no vendrian solo
  de la arquitectura.
- **En la imagen** cada Dockerfile copia unicamente `libs/` y su propia carpeta
  de `apps/`, y el `package.json` que emite `nx build`
  (`generatePackageJson: true`) lista solo las dependencias que esa app usa de
  verdad. La imagen de `b0-directo` no contiene nada de B1, B2 ni B3.

Ademas, los tags Nx y `@nx/enforce-module-boundaries` hacen que `pnpm lint`
falle si una arquitectura importa codigo de otra.

## 4. El backend de entrada siempre en el puerto 3000 del host

El frontend es **uno solo** y participa en los cuatro profiles de Compose. Un
servicio de Compose no puede tener un `BACKEND_URL` distinto por profile, asi
que cada arquitectura publica su servicio de entrada en el mismo puerto del
host (`3000`) y el frontend apunta ahi siempre.

Como solo corre un profile a la vez, no hay colision de puertos. Los servicios
internos de B3 y el `mcp-server` conservan sus propios puertos para poder
inspeccionarlos por separado.

## 5. La URL del backend se resuelve en tiempo de EJECUCION

Un `environment.ts` de Angular se compila dentro del bundle y obligaria a una
imagen distinta por arquitectura. En su lugar:

1. El bundle pide `config.json` antes de arrancar (`apps/web/src/main.ts`).
2. Al arrancar el contenedor, `infra/docker/entrypoint-web.sh` reescribe ese
   `config.json` con el valor de la variable `BACKEND_URL`.
3. nginx sirve `config.json` con `Cache-Control: no-store`.

Resultado: **una sola imagen de `web` para las cuatro arquitecturas**, sin
ninguna URL compilada. Hay dos pruebas en
`apps/web/src/app/presentation/shell/backend-status/backend-status.spec.ts` que
verifican que el componente consulta la URL configurada y no una fija.

Para desarrollo se acepta ademas `?backend=http://localhost:3002`, que apunta el
mismo frontend a otra arquitectura sin reconstruir.

## 6. `/health` fuera del prefijo `/api`

El endpoint de verificacion vive en `/health` y el resto de la API vivira bajo
`/api`. Se logra con `setGlobalPrefix('api', { exclude: [...] })`. Asi el punto
de verificacion es estable y no se mueve cuando la API se versione.

## 7. El frontend descubre la arquitectura, no la configura

`web` no recibe una variable que le diga "estas en B2". Recibe la URL del
backend, consulta `/health` y **muestra lo que el backend reporta**. Si por
error se levanta otra arquitectura, la UI muestra la real, no la esperada. Un
indicador que se puede configurar mal no sirve para verificar.

## 8. `libs/dominio` define vocabulario, no logica de triaje

La logica de triaje es justamente lo que el experimento compara, asi que
compartirla anularia el estudio. `libs/dominio` contiene solo tipos y catalogos
(areas de servicio, estados, prioridades, catalogo de arquitecturas). Cada
arquitectura implementara su propia coordinacion mas adelante.

## 9. Se retiraron los targets `prune` generados por Nx

El generador `@nx/nest:app` agrega los targets `prune-lockfile`,
`copy-workspace-modules` y `prune`, que asumen un `package.json` por proyecto
(layout de paquetes). En el layout clasico fallan. Se eliminaron de los siete
`project.json` para no dejar targets que rompen al invocarlos. El aislamiento de
dependencias se consigue igual, via el `package.json` que emite `nx build`.

En el runtime de la imagen las dependencias se instalan con
`npm install --omit=dev` a partir de ese `package.json`, cuyas versiones
directas estan fijadas exactamente. No hay lockfile por app, asi que la
resolucion de dependencias transitivas no es bit a bit reproducible; si el
estudio lo exige, se puede generar un lockfile por app en el build.

## 10. `@babel/core` fijado a la 7.x

Angular 22 arrastra `@babel/core` 8, pero `ts-jest` y `jest-preset-angular`
todavia declaran peer `^7`. Sin fijarlo, las pruebas unitarias de Angular no
corren. Se resolvio con un `overrides` en `pnpm-workspace.yaml`. Se puede
retirar cuando `ts-jest` soporte Babel 8.

## 11. `baseUrl` fuera de `tsconfig.base.json`

TypeScript 6 deprecó `baseUrl` (deja de funcionar en TS 7). Los `paths` se
declaran relativos al propio `tsconfig.base.json`, que es el comportamiento
soportado. `rootDir: "."` si se mantiene: es lo que permite que una app importe
codigo de `libs/` sin que `tsc` lo reporte fuera del `rootDir`.

## 12. Un Dockerfile por app

`infra/docker/` tiene un `Dockerfile.<app>` por aplicacion, todos derivados de
una misma plantilla de dos etapas. Se prefirio esto a un unico Dockerfile
parametrizado para que cada artefacto sea autocontenido y legible por separado,
y para poder hacer divergir una arquitectura (por ejemplo, agregarle un runtime
distinto) sin tocar las otras seis.

## 13. Frontend antes que backend: el contrato se fija primero

La interfaz de chat se construyo cuando ninguna arquitectura tenia logica de
triaje. Para que el backend se construya contra el frontend y no al reves, el
contrato de red vive en `libs/contratos`:

- `api.contrato.ts`: rutas (`RUTAS_API`) y cuerpo de error (`ErrorApiDto`) con
  la tabla de codigos y status HTTP.
- `conversacion.contrato.ts`, `ticket.contrato.ts`, `politica.contrato.ts`,
  `servicio.contrato.ts`: DTOs de entrada y salida.

El vocabulario nuevo (clasificaciones, niveles de estado de servicio, estados de
propuesta, limites de texto y maximo de politicas) se agrego a `libs/dominio`,
coherente con la decision 8: son tipos y constantes, no logica.

`POST /api/tickets/propuestas/:id/confirmacion` exige
`confirmacionExplicita: true` en el cuerpo. Deja escrito en el contrato que un
ticket nunca se crea por inferencia sobre el texto (HU-17).

## 14. Una sola decision entre backend simulado y real

> Reemplazada en su parte de simulacion por la decision 28.

`apps/web` sigue Clean Architecture:

| Capa              | Contiene                                             | Puede importar            |
| ----------------- | ---------------------------------------------------- | ------------------------- |
| `domain/`         | modelos, reglas, errores y puertos (interfaces)      | `@unihelp/*`              |
| `application/`    | tokens de los puertos, casos de uso, store (signals) | `domain/`                 |
| `infrastructure/` | repositorios `http/` y `mock/`, mappers              | todo lo anterior          |
| `presentation/`   | componentes                                          | `application/`, `domain/` |

La eleccion de implementacion ocurre en **un solo lugar**,
`infrastructure/provide-data-layer.ts`: cada token de puerto se resuelve con una
factory que lee el `InjectionToken` `USE_MOCK_BACKEND`. Su valor viene del
entorno de compilacion:

- `environment.development.ts` (`nx serve web`): `USE_MOCK_BACKEND: true`.
- `environment.ts` (build de produccion, imagen Docker): `false`.
- `nx serve web -c backend-real`: servidor de desarrollo contra el backend real.

Esto es una excepcion **deliberada** a la decision 5: la URL del backend sigue
resolviendose en ejecucion, pero "simulado o real" se fija al compilar. Una
imagen de produccion que pudiera responder con datos simulados contaminaria las
mediciones del experimento sin que nadie lo notara.

La regla no depende de la disciplina: `apps/web/eslint.config.mjs` hace fallar
el lint si `domain/` importa Angular o RxJS, o si `application/` o
`presentation/` importan algo de `infrastructure/`.

## 15. La simulacion se comporta como un servidor, no como un stub

> Reemplazada por la decision 28: la simulacion se elimino.

Los repositorios de `infrastructure/mock/` producen **los mismos DTOs del
contrato** y los pasan por **los mismos mappers** que los repositorios HTTP.
Asi, lo que se prueba con datos simulados ejercita tambien la traduccion
DTO -> dominio que usara el backend real.

- Latencia uniforme entre 300 y 1500 ms, respuestas serializadas (sin
  referencias compartidas) y errores con la forma de `ErrorApiDto`.
- Una "base de datos" en memoria con transacciones atomicas, persistida en
  `sessionStorage` para sobrevivir a recargas.
- Los datos viven en `mock/fixtures/`, tipados y separados de la logica: agregar
  un caso es agregar un objeto a `escenarios.fixture.ts`.
- Los fallos se provocan sin tocar codigo, por query string
  (`?simular-error=timeout`) o escribiendo una directiva en el chat
  (`#no-disponible`).

## 16. La base de conocimiento es una libreria compartida sobre PostgreSQL

Contexto: las cuatro arquitecturas y `mcp-server` necesitan citar politicas y
consultar el estado de servicios y componentes (HU-05 a HU-10). Si cada una
tuviera su propio buscador, una diferencia medida podria venir del buscador y no
del protocolo. La base de conocimiento es la "API del dominio" que todas
comparten (`docs/01-arquitectura-y-funcionalidades.md`, seccion 2), no la
variable que se mide.

Decision:

- `libs/conocimiento` (`@unihelp/conocimiento`, tags `tipo:lib`, `arq:compartido`,
  `alcance:backend`) expone `ConocimientoModule.forRoot()` y los casos de uso.
  Ninguna app lo importa todavia.
- El grafo se modela con **tablas de nodos y tablas de aristas en PostgreSQL 16**,
  en un esquema propio `conocimiento`. La composicion politica -> version ->
  extracto usa claves foraneas `NOT NULL`; las relaciones muchos a muchos
  (servicio-componente, politica-categoria, politica-servicio) son tablas de
  aristas con clave compuesta y `ON DELETE RESTRICT`.
- **TypeORM** como acceso a datos: es el primer ORM del monorepo, no habia uno
  decidido. La libreria abre su propio `DataSource`, con `synchronize`
  desactivado y migraciones versionadas en TypeScript.
- PostgreSQL corre en el profile `conocimiento` de Compose, con la imagen fijada
  por digest y datos en tmpfs.
- El frontend no puede importar la libreria: `eslint.config.mjs` prohibe a
  `arq:frontend` depender de `alcance:backend`.
- El estado de un componente usa `NivelEstadoServicio` de `@unihelp/dominio`
  (`operativo`, `degradado`, `interrumpido`, `mantenimiento`). HU-KB-09 dice
  `caído` donde el vocabulario compartido dice `interrumpido`; se eligio no
  redefinir el vocabulario ni hacer un cambio rompiente en el frontend, asi que
  `interrumpido` ocupa el lugar de `caído`. La fila de `AGENTS.md` §9 y la nota
  de HU-KB-09 se pueden retirar si esta equivalencia se acepta para todo el backlog.

Por que:

- Neo4j y ArangoDB se descartaron: su ranking y el orden de sus recorridos
  dependen del motor, mientras que en SQL el orden completo queda escrito en la
  consulta. Ademas, PostgreSQL ya se usara para tickets y auditoria: un segundo
  motor es mas infraestructura que un tercero debe levantar para replicar.
- Prisma se descarto porque no modela columnas `tsvector` generadas, triggers ni
  indices parciales sin SQL crudo, y agrega un paso de generacion de cliente al
  build. Con TypeORM las entidades describen las tablas y las consultas que
  importan para el experimento se escriben en SQL explicito.
- No va en `libs/dominio` porque tiene dependencias de runtime (regla 4 de
  `AGENTS.md`, que aplica a `contratos` y `dominio`, no a esta libreria).

Consecuencias: es la primera libreria con dependencias de runtime (`typeorm`,
`pg`, `@nestjs/common`). `resolveJsonModule` pasa a `tsconfig.base.json` porque la
semilla viaja como JSON importado. Quedan pendientes: conectar la libreria a
cada arquitectura, los estados iniciales de `docs/10` §4 como variantes de la
semilla y las politicas adversariales, cuyo contenido no esta escrito.

## 17. La busqueda de politicas y la huella del estado son deterministas por construccion

Contexto: HU-08 exige que dos consultas identicas sobre el mismo estado
devuelvan el mismo conjunto ordenado, sin modelos de representacion vectorial.
HU-36 exige un restablecimiento transaccional con una huella verificable. El
determinismo se puede perder en sitios poco evidentes: la collation de la base,
la precision de los flotantes, la zona horaria o el orden fisico de las filas.

Decision (detalle en `libs/conocimiento/README.md`):

- Busqueda lexica con `tsvector` y `ts_rank` sobre una configuracion
  `spanish` + `unaccent`. Relevancia = `ts_rank(tsv, consulta, 32)` x cobertura de
  lexemas, redondeada a 6 decimales en `numeric`.
- Maximo tres politicas, `ORDER BY relevancia DESC, codigo COLLATE "C" ASC`,
  solo versiones marcadas como vigentes. Bajo el umbral
  (`CONOCIMIENTO_UMBRAL_RELEVANCIA`, 0.05 por defecto) se devuelve una ausencia
  explicita con motivo.
- Todo `ORDER BY` de texto usa `COLLATE "C"`; en TypeScript se compara por punto
  de codigo, nunca con `localeCompare`.
- Los instantes viajan como texto ISO 8601 UTC con precision de segundos, no
  como `Date`, y se leen con `to_char(... AT TIME ZONE 'UTC')`.
- La huella es SHA-256 sobre una serializacion canonica versionada: tuplas con
  columnas en orden fijo y filas ordenadas por clave primaria. Se puede
  recalcular desde el archivo semilla sin base de datos.
- El restablecimiento borra y repuebla en una transaccion `SERIALIZABLE`, relee
  lo escrito y revierte si no es identico. Solo existe con
  `UNIHELP_PERFIL=experimento` o `NODE_ENV=test`, y nunca con
  `UNIHELP_PERFIL=produccion`.

Por que: embeddings o BM25 externos introducen variabilidad o dependencias que
no se atribuyen al protocolo. La cobertura se agrego porque `ts_rank` solo no
distingue una consulta que coincide en una palabra de otra que coincide en todo,
y eso llevaba a devolver la politica "mas cercana" en casos sin respuesta
(HU-07). No se uso `NODE_ENV=production` para prohibir el restablecimiento
porque las imagenes del experimento corren con ese valor.

Consecuencias: cambiar la semilla o la serializacion cambia la huella a
proposito; la huella dorada de `libs/conocimiento/src/aplicacion/huella.spec.ts`
y el README se actualizan en el mismo cambio. Cambiar de version mayor o menor
de PostgreSQL requiere volver a correr la prueba de integracion, porque los
diccionarios de texto completo forman parte del resultado.

## 18. La semilla reproduce los estados iniciales y el corpus de docs/10

Contexto: `docs/10-conjunto-de-tareas.md` define 10 estados iniciales, 24
politicas (3 adversariales sin texto) y 40 tareas que eligen un estado. La
primera semilla tenia un solo estado inventado, un componente compartido que
contradecia T-DIA-009 y ninguna politica adversarial. HU-KB-04 exige ademas
cuatro distractoras por politica objetivo, y docs/10 solo trae una pareja por
objetivo.

Decision (detalle en `docs/base-de-conocimiento.md`):

- `estados_servicio` guarda el estado publicado de cada servicio (estado,
  alcance, comunicado, ventana, referencia) y `servicios.nivel_servicio` el nivel
  que usa la tabla de prioridad. La fila `entorno` registra version de semilla,
  estado inicial y corpus, y entra en la huella.
- La semilla trae la variante base `todo_operativo` y los 10 estados de docs/10
  §4. `RestablecerConocimientoUseCase.ejecutar({ estadoInicial, corpus })`
  construye cualquiera; `calcularHuellasEsperadas` publica las 20 huellas.
- Cada componente pertenece a un solo servicio.
- Corpus `estandar` sin las politicas adversariales y corpus `adversarial` con
  ellas (docs/01, 4.3). No se filtran en la consulta: simplemente no se insertan.
- Las 3 politicas adversariales se redactaron desde T-ADV-001 a T-ADV-003. Se
  agregaron 15 distractoras y 13 versiones historicas (`origen` en la base y
  `notas` en la semilla). Comunicados, ventanas, referencias, instantes y nivel
  de servicio son sinteticos y coherentes con cada tarea. Estas tres decisiones
  las tomo el responsable del proyecto (RM-17).

Por que: sin los estados iniciales no hay huella esperada por tarea y el
ejecutor no puede abortar ante contaminacion (HU-36, M7.2). Filtrar las
adversariales en la consulta habria dejado un parametro de busqueda que cada
arquitectura podria usar distinto; excluirlas del corpus lo decide el ejecutor
al restablecer. Un componente compartido hacia imposible que el aula virtual se
viera operativa durante una caida de autenticacion.

Consecuencias: el corpus ya no coincide con el conteo de 24 politicas de docs/10.
Esa diferencia es una desviacion registrada: se resuelve actualizando la fuente
de docs/10 o aceptandola. Las distractoras agregadas pueden hacer mas dificiles
las tareas informativas; eso se decidio a proposito (HU-KB-04). Cambiar un
estado inicial o una politica cambia su huella, y la tabla de
`docs/base-de-conocimiento.md` se regenera en el mismo cambio.

## 19. Las metricas solo se calculan en Python, en un cuaderno unico

Contexto: el experimento produce 43 metricas y un panel web las mostrara. Si una
cifra se calcula en dos lugares (por ejemplo, el cuaderno y Angular), tarde o
temprano dan resultados distintos y nadie sabe cual cito el manuscrito (HU-MET-04,
HU-MET-09, RM-02).

Decision: todo calculo vive en `experiment/analisis/` y se orquesta desde
`experiment/analisis.ipynb`, que corre sin intervencion con papermill
(`pnpm analisis:desde-cero`). Los backends solo producen trazas y las validan con
`libs/trazas`; el panel solo leera `experiment/salidas/resultados.json`, cuyo
contrato es `experiment/schemas/resultados.schema.json`. Cada tabla o figura sale de
una celda con su etiqueta (`tabla_2`, `figura_1`) y queda en `manifiesto.json` con su
SHA-256. Detalle en `docs/sistema-de-metricas.md`.

Por que: un solo punto de calculo es auditable y reproducible. Para que dos
ejecuciones den los mismos archivos salvo `generado_en`, el JSON se escribe con
claves ordenadas y flotantes redondeados a 6 decimales, los SVG sin fecha y con
`svg.hashsalt` fijo, y la semilla del remuestreo esta en el registro. Una prueba
ejecuta el cuaderno dos veces y compara byte a byte.

Consecuencias: ningun DTO de `libs/contratos` transportara metricas calculadas. Una
metrica nueva se agrega al registro y a una familia de Python, nunca a una app.

## 20. El entorno Python del analisis se gestiona con uv

Contexto: el analisis necesita Python 3.12 con pandas, pyarrow, numpy, scipy,
statsmodels, scikit-learn, jsonschema, pyyaml, matplotlib y papermill; se podia
elegir uv o poetry.

Decision: uv, con `experiment/pyproject.toml`, `experiment/uv.lock` y
`experiment/.python-version`. `experiment/project.json` registra el proyecto Nx
`analisis` con los targets `instalar`, `fixtures`, `ejecutar` y `test`.

Por que: uv instala el propio interprete 3.12 (poetry no), su lockfile es
multiplataforma y es rapido en Windows, donde se desarrolla. Registrar el proyecto
en Nx hace que `pnpm verify` corra tambien las pruebas de Python.

Consecuencias: `pnpm verify` y `pnpm analisis:test` requieren uv instalado. El
cuaderno falla al inicio si no corre con Python 3.12.

## 21. El esquema de traza vive en experiment/schemas y TypeScript lo genera

Contexto: la traza la escribe TypeScript (NestJS) y la lee Python. Si cada lado
declara su propio formato, se desincronizan (HU-MET-01).

Decision: `experiment/schemas/traza.schema.json` (JSON Schema 2020-12,
`version_esquema` 1.0.0) es la unica fuente. `pnpm nx run trazas:generar` produce
`libs/trazas/src/lib/traza.generado.ts` (json-schema-to-typescript) y embebe el
esquema en `esquema-traza.generado.ts`; `sincronia-esquema.spec.ts` falla si no se
regenero. `PersistidorTrazas` valida con AJV antes de escribir y aparta las invalidas
en `cuarentena/`; la carga de Python revalida con jsonschema y agrega las
comprobaciones aritmeticas. Los casos de `experiment/schemas/ejemplos/` los juzgan
igual AJV y jsonschema. Nombres de campo: los de `docs/05`, salvo la procedencia
(`provenance.semilla`, `provenance.version_codigo`, `provenance.modelo_id`) y
`version_esquema`, fijados para esta entrega. `estado_inicial_incorrecto` (docs/09,
seccion 13) es un motivo de rechazo de la carga y no un estado de la traza, porque
esa ejecucion se aborta antes de producir traza. La lib lleva el tag
`alcance:backend`.

Por que: se embebe el esquema en TypeScript en lugar de importar el JSON porque las
imagenes Docker solo copian `libs/` y `apps/`. La aritmetica (residuo de
orquestacion) no va en AJV para no calcular en TypeScript (decision 19).

Consecuencias: cambiar el esquema exige subir `version_esquema` y regenerar en el
mismo commit. La validacion del residuo corre en la carga, no al persistir: queda
anotado en las discrepancias de `AGENTS.md`.

## 22. El registro nombra los campos; el codigo solo usa alias

Contexto: HU-MET-02 exige que el calculo lea su fuente del registro. Varias metricas
de M1, M4 y M7 dependen de artefactos que todavia no existen (juez, calificacion
humana, microbenchmark, reproduccion, corrida de control).

Decision: en `experiment/metricas.yaml` cada fuente es `{artefacto, campos: {alias:
campo}}` y las funciones piden columnas por alias. Pruebas de pytest verifican que
registro y funciones coinciden, que todo campo de traza existe en el esquema y que
ningun modulo escribe el nombre de un campo. La poblacion de cada metrica
(efectividad, latencia o costo) y la tabla de estados finales de docs/09 estan en el
registro. Los artefactos que aun no existen tienen un formato **provisional** en
`experiment/schemas/insumos.schema.json`: `exito` (M1) se lee de
`puntuaciones.jsonl`; sin el insumo, la metrica queda `sin_datos`, nunca en cero. Los
contrastes entre arquitecturas se estiman con intervalo y no deciden hipotesis.

Por que: renombrar un campo toca un solo archivo y no puede dejar una metrica leyendo
un campo inexistente. Declarar los formatos provisionales permite probar todo el
pipeline con la corrida sintetica antes de la primera ejecucion real (HU-MET-08).

Consecuencias: cuando existan el juez y los demas productores, se fijan sus formatos,
se quita `provisional` y se revisan los alias. Las familias M2, M3, M5 y M6 estan
declaradas como `pendiente`.

## 23. B0 usa gpt-5.4-mini-2026-03-17 de OpenAI con temperatura 0.2

Contexto: docs/00 (pregunta 4) exige fijar el modelo y su snapshot antes de
construir B0; no existia `experiment.config.yaml` ni proveedor elegido.

Decision (tomada por el responsable del proyecto): proveedor OpenAI, modelo
`gpt-5.4-mini-2026-03-17`, Chat Completions con `temperature: 0.2`, `top_p: 1` y
`max_completion_tokens: 2048` (docs/07, seccion 2), `parallel_tool_calls: false`
(D1) y sin reintentos automaticos del SDK. Se configura con variables de entorno
(`apps/b0-directo/.env.example`); la clave vive solo en `apps/b0-directo/.env`,
que git ignora.

Por que: con function calling este modelo solo admite `reasoning_effort: none`
en Chat Completions, y en ese modo si acepta temperatura, asi que se respeta la
temperatura 0.2 de docs/07. Sin reintentos, un `rtt` nunca mezcla dos peticiones (M4.2).

Consecuencias: **OpenAI cachea automaticamente los prompts largos y no se puede
desactivar**, lo que contradice D2 (RM-07). B0 registra `cached_input_tokens`
tal como lo reporta el proveedor; en las primeras pruebas fue mas de la mitad de
la entrada. Antes de la corrida oficial hay que decidir si se acepta la
desviacion (declarandola en el registro de desviaciones) o se cambia de
proveedor. Queda pendiente, por RM-17.

## 24. Las cinco herramientas son las de docs/02, con tres ajustes de contrato

Contexto: DP-01 de `apps/b0-directo/docs/ARQUITECTURA.md`: el encargo proponia un
reporte agregado en lugar de `confirmar_propuesta`, y las 40 tareas usan las
cinco de docs/02.

Decision (tomada por el responsable del proyecto): `buscar_politica`,
`consultar_estado_servicio`, `proponer_ticket`, `confirmar_propuesta` y
`crear_ticket_simulado`, definidas una sola vez en
`libs/herramientas/src/lib/definiciones-herramientas.ts`. Ajustes respecto de
docs/02: `max_resultados` llega a 3 (HU-05), `consultar_estado_servicio` no tiene
`incluir_historial` (la base no guarda historial) y `proponer_ticket` no pide
`solicitante` (sin autenticacion el modelo solo podria inventarlo). Las salidas
agregan `motivo_sin_resultados` (HU-07) y `ventana_estimada` (HU-10).

Por que: las tareas, M2.1, M2.2 y M2.4 dependen de esos nombres. Los ajustes
evitan campos que el sistema no puede llenar con verdad.

Consecuencias: el reporte agregado (F-6, HU-23) sigue sin herramienta. Los
ajustes son una discrepancia con docs/02 y se anotan en `AGENTS.md` seccion 9.

## 25. La prioridad la escribe el modelo y la verifica el codigo

Contexto: DP-02: HU-11 pide que la prioridad salga de la tabla y no del modelo,
pero docs/02, las tareas (`args_parciales.prioridad`) y M3.5 esperan que el
modelo la escriba.

Decision (tomada por el responsable del proyecto): el modelo pasa la prioridad a
`proponer_ticket`; `ProponerTicketUseCase` (`libs/tickets`) la rechaza con
`VALIDACION_ENTRADA` si ninguna fila de la tabla de docs/01 F-3 la respalda para
el estado publicado del servicio, e indica los valores admitidos. En
mantenimiento no se propone ticket (HU-12). Las combinaciones que la tabla no
cubre no reciben una prioridad inventada.

Por que: ningun ticket queda con una prioridad improvisada (HU-11), y M3.5 y M2.3
siguen midiendo si el modelo aplica la tabla.

Consecuencias: la tabla vive en una libreria compartida, no en cada arquitectura.
La decision 8 dice que priorizar es de cada arquitectura; aqui se interpreta que
la tabla es una regla institucional publicada (dato del dominio) y que aplicarla
al diagnostico sigue siendo del agente.

## 26. Capacidades compartidas y confirmacion por turno real (provisional)

Contexto: DP-05, DP-06 y DP-07: la garantia de H4, la validacion y el
saneamiento tienen que ser el mismo codigo en B0 y B1, y la confirmacion no puede
depender de lo que el modelo diga que escribio la persona.

Decision (provisional, implementada con la opcion propuesta en la arquitectura de
B0 y pendiente de ratificacion del equipo por RM-17):

- `libs/tickets` y `libs/herramientas` (tags `arq:compartido`, `alcance:backend`)
  contienen los casos de uso, la validacion, el saneamiento y la medicion del
  receptor.
- El controlador de entrada registra el texto literal de cada turno en
  `tickets.turnos_usuario` antes de que el modelo lo vea, y
  `ConfirmarPropuestaUseCase` solo emite token si el texto coincide con un turno
  posterior a la propuesta.
- La ruta del frontend `POST .../confirmacion` emite el token internamente a
  partir de la accion explicita del boton, por los mismos casos de uso.
- El marcador de delimitacion se deriva del `trace_id` (DP-04 sigue abierta: rompe
  la reproduccion si el `trace_id` cambia entre grabacion y reproduccion).

Por que: es la unica forma encontrada de que la garantia sea identica en B0 y B1
y no dependa del modelo.

Consecuencias: B1 tendra que registrar tambien los turnos en su controlador de
entrada. Si el equipo elige otra opcion para DP-05, cambia lo que mide M5.1.

## 27. La interfaz elige proveedor y modelo; la clave se queda en el servidor

Contexto: la pantalla de Configuracion tenia un selector de proveedor con un
campo de clave de API que solo se guardaba en `localStorage` y no cambiaba nada
(el propio codigo lo advertia). Se pidio que funcionara de verdad.

Decision (tomada por el responsable del proyecto):

- La clave del proveedor vive SOLO en el servidor (`apps/b0-directo/.env`). La
  interfaz nunca la envia ni la recibe; solo ve si esta configurada.
- El backend publica el catalogo en `GET /api/modelo-ia`: que proveedores hay,
  cuales estan disponibles y con que modelos (`UNIHELP_MODELOS_PERMITIDOS`,
  todos con fecha de snapshot). `PUT` cambia la eleccion y vuelve a validarla.
- B0 solo integra OpenAI; Gemini, Claude y el agente local aparecen en la lista
  como no disponibles, con su motivo.
- **Una corrida del experimento ignora la eleccion de la pantalla.** Si la
  peticion trae `X-Trace-Id` (la manda el ejecutor), se usa el modelo de
  `UNIHELP_MODELO_ID`. Asi las cuatro arquitecturas miden con el mismo modelo
  (RNF-01) y la traza registra uno solo (RNF-08).
- En modo `replay` la pantalla queda de solo lectura: los casetes estan grabados
  con un modelo concreto.

Por que: un token real no debe vivir en el navegador, y una eleccion visual que
cambiara el modelo de una corrida oficial contaminaria la comparacion sin que
nadie lo notara.

Consecuencias: `libs/contratos` gana `modelo-ia.contrato.ts` y la ruta
`RUTAS_API.modeloIa`; `libs/dominio`, el vocabulario `PROVEEDORES_MODELO`. B1,
B2 y B3 tendran que responder esa ruta cuando existan (regla 5). Integrar otro
proveedor exige un cliente nuevo y una decision aparte.

## 28. El frontend ya no tiene capa de datos simulada

> Reemplaza a las decisiones 14 y 15 en lo que toca a la simulacion.

Contexto: el frontend se construyo antes que el backend y traia repositorios
simulados (`infrastructure/mock/`, 23 archivos) con su propia base en memoria,
latencia y escenarios. Desde que B0 responde el contrato completo, el chat se
puede probar contra un backend real.

Decision (tomada por el responsable del proyecto): se elimina la capa simulada,
el token `USE_MOCK_BACKEND`, la configuracion `simulacion` de los entornos y las
pruebas que la usaban como backend (`chat-page.spec.ts`,
`provide-data-layer.spec.ts` y las del propio mock). `provideDataLayer()` enlaza
cada puerto con su repositorio HTTP y nada mas.

Por que: dos implementaciones del mismo contrato se desincronizan, y la
simulacion ya no aporta: para ver la interfaz basta con levantar B0.

Consecuencias: `pnpm dev:web` ya no funciona por si solo; hay que levantar un
backend (`pnpm dev:web:b0`). Se pierde la prueba de extremo a extremo del chat
con datos simulados: el chat queda cubierto por las pruebas de sus piezas
(store, mappers, repositorios HTTP y componentes) y por la validacion en
navegador contra B0. Lo que decian las decisiones 14 y 15 sobre elegir entre
simulado y real ya no aplica; lo demas de la decision 14 (las capas de Clean
Architecture y que la eleccion viva en un solo archivo) sigue vigente.

## 31. Entre ejecuciones se vacia el registro de tickets, nunca la auditoria

> Resuelve DP-15 de `apps/b0-directo/docs/ARQUITECTURA.md`.

Contexto: `RestablecerConocimientoUseCase` deja la base de conocimiento en la
variante que pide la tarea y devuelve su huella (HU-36), pero los tickets no se
restablecian. Sin restablecerlos, la ejecucion numero 20 arranca con las
propuestas y los tickets de las 19 anteriores, y `esperado.ticket.debe_crearse`
deja de verificarse contra un estado conocido.

Decision (consultada con el responsable, RM-17): `RestablecerTicketsUseCase`
vacia las cuatro tablas del esquema `tickets` y reinicia la secuencia de
numeracion antes de cada ejecucion. **Nunca** toca `auditoria.eventos`.

Por que: la auditoria es de solo agregar (HU-35, RM-09) y es la fuente
independiente contra la que se comprueba si hubo una escritura no autorizada
(M5.1). Si se vaciara junto con los tickets, la verificacion se haria contra el
mismo registro que el agente escribe, que es justo lo que la rubrica evita
(docs/04, seccion 4: «verificado contra la auditoria del servidor y no contra lo
que el agente afirme haber hecho»). Un disparador de la migracion ya rechaza
`TRUNCATE` sobre esa tabla, asi que la regla esta sostenida por el esquema y no
solo por el codigo.

Consecuencias: el caso de uso solo se registra con `UNIHELP_PERFIL=experimento`
o `NODE_ENV=test`, igual que el de conocimiento, y fuera de ese perfil no existe
como capacidad. El estado vacio de tickets **no** entra en
`provenance.state_hash_inicial`, que sigue cubriendo solo la base de
conocimiento: si mas adelante se quiere una huella del estado completo, hay que
decidirla aparte. La auditoria crece entre corridas; como cada consulta filtra
por `trace_id`, eso no afecta a ninguna medicion.

## 32. El backend entrega lo que midio; el ejecutor arma y valida la traza

> Resuelve DP-09 de `apps/b0-directo/docs/ARQUITECTURA.md`.

Contexto: B0 mide tiempos, tokens y llamadas a herramientas en
`InstrumentadorTrazas`, pero esas mediciones vivian solo en la memoria del
proceso. Nadie las persistia, asi que el experimento no tenia trazas reales.
B0 tampoco puede armar la `TrazaEjecucion` completo: no conoce la tarea, la
repeticion ni la huella del estado inicial, que son del ejecutor.

Decision (consultada con el responsable, RM-17): cada backend expone dos rutas
para el ejecutor, declaradas en `libs/contratos/src/lib/experimento.contrato.ts`:

- `POST /experimento/restablecer` deja el entorno en la variante de la tarea y
  devuelve la huella;
- `GET /experimento/trazas/:traceId` devuelve **solo lo que el backend sabe**:
  desglose de latencia, consumo de tokens, `tool_calls[]`, el objeto final,
  como termino cada turno, la auditoria de ese `trace_id` y los tickets creados.

El ejecutor (`experiment/ejecutor/`, Python) junta eso con la identidad de la
ejecucion, arma la traza, la valida contra `traza.schema.json` y solo entonces
la persiste. La invalida va a `cuarentena/`.

Por que: tres razones. Primera, el reparto de responsabilidades es el real: cada
pieza aporta lo que efectivamente sabe y nadie inventa un campo. Segunda, el
contrato esta en `libs/contratos` y no dentro de B0 para que las cuatro
arquitecturas respondan exactamente lo mismo; si cada una entregara su traza a
su manera, el ejecutor tendria cuatro clientes y una diferencia de medicion
podria venir del ejecutor en vez del protocolo. Tercera, validar antes de
persistir es el paso 7 de docs/05: elimina el riesgo de resultados incompletos
en el momento de producirlos y no auditandolos al final (HU-38).

Las rutas viven **fuera del prefijo `/api`**, como `/health` (decision 6):
`/api` es el contrato del frontend y ningun componente de `apps/web` las llama.
Sus campos usan los nombres del esquema de traza (`tool_calls`, `input_tokens`)
y no la convencion en español del repositorio, porque son los nombres del
registro de metricas y traducirlos dos veces solo agrega una forma de
equivocarse (RM-08, decision 22).

Consecuencias: el controlador solo se registra con `UNIHELP_PERFIL=experimento`;
en cualquier otro perfil las rutas devuelven 404, de modo que restablecer una
instancia con datos no es posible por accidente. B1, B2 y B3 deben implementar
las mismas dos rutas cuando existan (regla 5 de `AGENTS.md`). `libs/trazas`
sigue siendo el validador de TypeScript, pero hoy no lo usa nadie en el camino
de la corrida: quien valida es el ejecutor, con el mismo esquema.

## 33. Los sistemas universitarios se emulan en una app aparte, sin datos propios

Contexto: las 40 tareas de `docs/tasks` declaran en `estado_inicial.servicios` el
estado de cuatro sistemas universitarios (aula virtual, correo institucional,
autenticacion y matricula) en una de diez variantes (`estado_inicial.overlay`).
En el caso de uso real cada uno seria un sistema distinto, operado por su
dependencia y con su propio endpoint de salud. Aqui no existen, y hasta ahora la
unica forma de ponerlos en un estado concreto era `pnpm conocimiento:restablecer`
por linea de comandos o `POST /experimento/restablecer` de B0, que solo existe
con `UNIHELP_PERFIL=experimento`.

Decision (tomada por el responsable del proyecto): se agrega
`apps/simulador-servicios`, una app NestJS con tag `arq:compartido` en el puerto
3020, que emula los cuatro sistemas con un controlador por sistema y publica su
estado por HTTP bajo `/simulacion/*`. Tres puntos fijan su alcance:

1. **No tiene datos propios.** Su unica fuente es `libs/conocimiento` sobre
   PostgreSQL, exactamente la misma que leen los agentes. El simulador solo la
   publica y permite conmutar de estado inicial.
2. **Vive en su propio profile de Compose (`simulacion`)**, no en `b0`..`b3`: las
   arquitecturas siguen leyendo el estado de servicios en proceso desde la
   libreria, no por HTTP.
3. **Esta pensado tambien para las corridas del experimento**, no solo para
   demostracion: `POST /simulacion/estado-inicial` devuelve la misma huella que
   `calcularHuellasEsperadas` (verificado sobre las diez variantes), asi que el
   ejecutor puede usarlo como punto unico para dejar el entorno como la tarea
   pide.

Por que asi y no de otra forma:

- **Si el simulador tuviera su propio estado en memoria**, habria dos copias de
  la semilla. La huella de HU-36 cubre lo que hay en PostgreSQL; lo que el
  simulador mostrara por su cuenta quedaria fuera de ella, y las dos podrian
  divergir sin que nadie lo notara.
- **Si el agente consultara el estado por HTTP al simulador**, aparecerian
  transporte y latencia de red donde hoy no hay ninguno. Eso cambia `M4` y
  convierte a B0 en algo que ya no es "el agente llama a las capacidades como
  funciones locales". Seria otra variable manipulada y exigiria rehacer la
  comparacion.

Consecuencias:

- `libs/dominio` gana el vocabulario publicado (`ESTADOS_SERVICIO_PUBLICADOS`,
  `ESTADO_SERVICIO_PUBLICADO`) y recibe `ALCANCES_AFECTACION` y
  `NIVELES_SERVICIO`, que estaban en `libs/conocimiento` y ahora tambien viajan
  por red. `libs/conocimiento` los reexporta: nadie tuvo que cambiar sus
  importaciones. `RolServicio` gana `sistema-emulado` y `ProtocoloIntegracion`,
  `ninguno`.
- El adaptador de `consultar_estado_servicio` de B0 usa la tabla compartida en
  vez de su copia. El comportamiento no cambia: era la misma tabla.
- `libs/contratos` gana `simulacion.contrato.ts`. El bloque de estado por
  sistema usa los nombres del YAML (`estado`, `alcance`,
  `componentes_afectados`, en mayusculas) y no la convencion camelCase del
  repositorio, por el mismo motivo que `TrazaParcialDto` (decision 22): el punto
  es comparar la respuesta con la tarea sin traducir nada.
- `libs/conocimiento` gana `ListarEstadosInicialesUseCase` (lee la semilla, no la
  base) y `ConsultarEntornoUseCase` (lee la fila `entorno`; usa `leerEstado()`,
  asi que no debe llamarse dentro del camino que se mide).
- Conmutar el estado inicial **no** borra el estado en proceso de la
  arquitectura que este corriendo (conversaciones, instrumentacion, tickets).
  Eso lo sigue haciendo `POST /experimento/restablecer` en cada backend
  (decision 32), que es lo que llama el ejecutor hoy
  (`experiment/ejecutor/cliente.py`). **El ejecutor no se cambio aqui.** El
  simulador esta listo para servirlo: devuelve exactamente las mismas huellas
  que el ejecutor valida contra `huellas-variantes.json`, verificado sobre las
  diez variantes. Apuntarlo alli exige decidir antes el orden de las dos
  llamadas y, si para entonces el experimento ya esta congelado, entrada en el
  registro de desviaciones (RM-13, RM-17).
- El comunicado de un sistema viaja **sin sanear**: aqui es la salida de un
  sistema externo, no la entrada de un modelo. Sanearlo borraria justamente lo
  que mide `T-ADV-007`. Quien lo ponga en un prompt es responsable de
  delimitarlo, como ya hace el adaptador de B0.

## 34. Ante dos politicas que se solapan, el agente elige por las circunstancias

Contexto: causa C7 de
`apps/b0-directo/docs/HALLAZGOS-CORRIDA-2026-09-22.md`. En T-INF-005 y T-INF-002
la busqueda devuelve la pareja de distraccion completa (cancelacion ordinaria y
extemporanea) y el agente cita la que la tarea declara prohibida. Escribir en el
prompt "no cites POL-MA-001" seria ensenarle a pasar esa prueba concreta, no a
distinguir, y ademas contaminaria M1.2 en las informativas.

Decision (tomada por el responsable del proyecto, RM-17): el prompt base lleva
una regla de criterio, no una lista de codigos: cuando dos politicas recuperadas
regulan el mismo tramite en circunstancias distintas, el agente se queda con la
que coincide con las circunstancias que la persona describio (la semana del
semestre, el motivo, el estado del servicio) y, si no alcanzan para decidir, lo
dice en vez de elegir al azar.

Por que: distinguir dos politicas parecidas es lo que HU-05 y HU-06 piden del
sistema, y la regla se enuncia sin nombrar ninguna politica ni ninguna tarea, asi
que vale igual para las parejas de distraccion que el corpus ya tiene y para las
que se agreguen despues.

Consecuencias: al interpretar M1.2 en las informativas hay que declarar que el
prompt guia la eleccion entre politicas solapadas; la diferencia entre
arquitecturas sigue siendo comparable porque el prompt base es el mismo en las
cuatro (RNF-01). Si el equipo concluye que la regla facilita demasiado la tarea,
retirarla es cambiar una linea, y entonces esta decision se reemplaza.

## 35. La propuesta de ticket se hace, no se anuncia

Contexto: en la corrida `b0-arreglada-v3` (22 de septiembre de 2026), nueve de
los trece fallos eran de la familia compuesta y casi todos por el mismo motivo,
`falta_herramienta_obligatoria:proponer_ticket`. El agente entendia la regla de
dos fases pero la convertia en tres. Al revisar las trazas aparecieron tres
conductas distintas, no una:

1. Anunciaba la propuesta en vez de hacerla: "si quieres, te preparo la
   propuesta para que luego la confirmes".
2. Redactaba el resumen de su cuenta y preguntaba "¿quieres que lo cree?" sin
   haber llamado nunca a `proponer_ticket`.
3. Llamaba a `proponer_ticket` con una prioridad que la tabla no admite, el caso
   de uso la rechazaba (decision 25) y, en vez de reintentar con el valor que el
   error le indicaba, aplazaba la correccion al turno siguiente.

Las tres terminan igual: el backend no responde `accion_sugerida:
proponer-ticket`, el ejecutor no envia el turno de confirmacion
(`experiment/ejecutor/cliente.py`) y la tarea pierde ademas
`confirmar_propuesta` y `crear_ticket_simulado`.

Decision: se corrige en el prompt base (1.2.0) y en la descripcion de la
herramienta, no en el bucle del agente:

- `proponer_ticket` se describe por lo que hace: redacta la propuesta, no crea
  nada y no necesita permiso, porque es la unica forma de obtener el resumen.
- El prompt prohibe anunciar la propuesta, prohibe redactar un resumen de ticket
  a mano y aclara que llamar a la herramienta no termina el turno.
- Una herramienta que rechaza una llamada se vuelve a llamar corregida en el
  mismo turno; aplazarlo es un fallo.
- La tabla de prioridad dice explicitamente que el alcance parcial nunca llega a
  P2, que era el error concreto que disparaba el rechazo.
- Se precisa el disparador: ademas de pedir reportar, registrar, dejar
  constancia o abrir un caso, tambien justifica proponer que la persona pida que
  le recomienden que hacer ante una falla que el estado del servicio confirma.
  Preguntar solo que esta pasando, por que le ocurre o si el problema es suyo no
  lo justifica: eso es lo que separa la familia compuesta de la de diagnostico
  (HU-13, HU-17).

Por que en el prompt y no en el codigo: la garantia mecanica nunca estuvo en
riesgo (sin token no hay ticket, decision 25) y meter en el bucle un detector de
"pidio confirmacion sin propuesta" seria tocar justo la parte que el experimento
mide, la coordinacion del agente. Si mas adelante se decide poner esa red, hay
que ponerla igual en las cuatro arquitecturas y registrarlo aparte.

Consecuencias: el disparador "pedir una recomendacion" es una lectura de HU-13
que conviene confirmar con el equipo, porque mueve la frontera entre las
categorias compuesta y diagnostico y con ella M1 y M1.3. Las dos tareas de
control de diagnostico (T-DIA-001 y T-DIA-004, donde proponer esta prohibido)
siguieron pasando despues del cambio. Si el equipo rechaza esa lectura, se quita
la frase y esta decision se reemplaza. Cambiar el prompt cambia `prompt_hash` en
todas las trazas: las corridas anteriores no son comparables con las posteriores
(RM-13).

## 36. El alcance del prompt nombra los tramites con el vocabulario de la normativa

Contexto: la recuperacion es lexica y determinista (RM-01, HU-08). Al reproducir
el ranking en `psql` se vio que las consultas que el agente arma con el relato
de la persona no recuperan la politica correcta («habilitar curso del semestre
pasado» no alcanza a «Apertura temporal de un curso archivado»; «no puedo
inscribir asignaturas» no alcanza a «Matricula extemporanea»), mientras que las
consultas con el vocabulario de los titulos la recuperan de primera. El
problema no esta en `libs/conocimiento`: esta en que el modelo no conoce el
vocabulario institucional.

Decision: el prompt base (1.3.0) describe el alcance de cada servicio con la
lista de tramites que la normativa regula, con el nombre que usa la normativa,
para los cuatro servicios por igual y sin ningun codigo de politica; y agrega
la correspondencia general entre una falla y su tramite cercano (no poder
entrar es desbloqueo o recuperacion de acceso, no poder entregar es prorroga
por falla tecnica). Ademas, el filtro `servicio` va siempre (la compuerta exige
que la busqueda obligatoria lo lleve, `experiment/ejecutor/compuerta.py`) y el
filtro `categoria` no se usa, porque excluye y escondia la politica (C2).

Por que no es ensenarle las respuestas: la lista es el catalogo completo de
tramites del corpus (39 politicas), no las de las tareas; una persona nueva en
la mesa de ayuda recibiria el mismo catalogo. Lo que la tarea mide sigue siendo
si el agente busca, si elige entre politicas parecidas y si cita la correcta.

Consecuencias: el prompt base crece (mas tokens de entrada en las cuatro
arquitecturas por igual, RNF-01) y `prompt_hash` cambia. Si el corpus agrega
politicas, esta lista se actualiza en el mismo cambio; si el equipo considera
que el catalogo facilita demasiado M1.2, se retira y esta decision se reemplaza.

## 37. El visor en vivo reproduce las tareas en el navegador y le pide el veredicto a Python

Contexto: el equipo necesitaba ver como se comporta una arquitectura tarea por
tarea (que teclea la persona, que responde el agente, cuanto consume) sin abrir
trazas JSONL, y poder configurarlo: que tareas, a que ritmo, como se confirma.
Playwright ya estaba en el repositorio como MCP para validar el frontend.

Decision: `experiment/visor/` es un proyecto de Playwright (`@playwright/test`,
Chrome del sistema) que genera una prueba por tarea de `docs/tasks`, teclea los
turnos con una persona simulada de semilla fija y muestra en un panel inyectado en
la pagina lo que el backend devuelve en `GET /experimento/trazas/:traceId`. Al
terminar cada tarea escribe una observacion y llama a
`python -m ejecutor puntuar-observacion`, que arma la traza con `armar_traza`,
la valida y aplica `compuerta.evaluar`; `importar-visor` convierte un
`observaciones.jsonl` en un directorio de corrida marcado `origen: visor`. La
configuracion vive en `visor.config.yaml` con anulaciones `VISOR_*`. Un solo
worker y sin reintentos. Los proyectos `tipo:experimento` pueden depender de
`arq:compartido` (regla de limites en `eslint.config.mjs`).

Por que: el visor podria haber calculado la compuerta en TypeScript, pero eso
duplicaria la regla que decide el exito (RM-02, RM-16) y tarde o temprano
divergiria del ejecutor. Delegar en Python cuesta un proceso por tarea y a
cambio garantiza que "supera" significa lo mismo en el navegador y en la corrida
oficial. Se reutiliza el frontend real, y no un cliente HTTP con pantalla, para
que lo que se ve sea lo que una persona veria (HU-17 incluido: el boton de
confirmar existe como opcion, aunque no sea comparable con el ejecutor).

Consecuencias: una corrida del visor no es una corrida del ejecutor (orden
manual, persona simulada, tiempos de lectura) y su manifiesto lo declara; sus
cifras no entran al analisis salvo que alguien las importe a proposito. La
resta entre lecturas consecutivas de la traza parcial, para atribuir tokens a
cada turno, es presentacion y no metrica. El panel depende del selector
`.disposicion` del frontend solo para no tapar el chat.

## 38. El panel del experimento vive en el frontend y lee archivos estaticos

Contexto: las historias HU-MET-09 a HU-MET-14 piden un panel web que muestre
`resultados.json` sin calcular nada (RM-02), que declare cuando el archivo no
existe o su version no coincide, y que sea de **solo lectura, sobre archivos
estaticos, sin backend propio** (HU-MET-14, obligatoria). El equipo ademas
quiere ver, desde el mismo `localhost:4200`, que tareas se van a correr, que
espera cada una, y como se comporto cada ejecucion de una corrida.

Decision: el panel es una seccion del frontend unico (`apps/web`, ruta
`/experimento`, carga perezosa) y no una app aparte. Los archivos que lee se
publican como assets estaticos bajo `datos-experimento/` (`project.json`):
`docs/tasks/T-*.yaml`, `experiment/ejecutor/corrida.yaml`,
`experiment/salidas/*` y `experiment/corridas/*`. Como un servidor estatico no
lista directorios, el ejecutor escribe `corridas/indice.json` al terminar cada
corrida (`ejecutor indice` lo regenera). El puerto `ExperimentoRepository` no
tiene ningun metodo de escritura; la unica peticion que sale del origen es
`GET /health` a un backend, y la dispara la persona desde "Preparar corrida".
Esa pantalla no lanza la corrida: arma la linea exacta de `pnpm ejecutor:correr`
para copiarla, porque lanzarla desde el panel contradiria HU-MET-14 y la
decision queda registrada como pendiente (RM-17). Los tipos de `resultados.json`
y de la traza se declaran a mano en `infrastructure/estaticos/experimento.dto.ts`
porque `libs/trazas` es `alcance:backend` y el frontend no puede importarla
(decision 16); el mapper rechaza otra version del esquema.

Por que: el mismo bundle sirve a las cuatro arquitecturas y ya lleva el tema, la
tipografia y la paleta; una app nueva duplicaria todo eso para una pantalla de
lectura. Servir archivos estaticos cumple HU-MET-14 al pie de la letra y en
desarrollo muestra la corrida recien escrita sin ningun proceso adicional. El
panel dibuja sus graficas en SVG propio (sin libreria) para que el chat no
cargue una dependencia de graficas y para poder descargarlas en SVG o PNG con
los colores del tema; las figuras del cuaderno se sirven ademas tal cual, con su
SHA-256 del manifiesto.

Consecuencias: el panel no muestra ninguna cifra que no venga escrita en un
archivo: los conteos de una corrida son los del manifiesto del ejecutor y las
tasas, medianas e intervalos son los de `resultados.json`. Una metrica de
resultado abierto nunca lleva aprobado/reprobado (RM-14). En la imagen Docker
los datos son la copia del momento de construir; el uso previsto es en
desarrollo. Queda pendiente, y requiere decision del responsable, si se agrega
un servicio local que lance el ejecutor desde el panel (afecta HU-MET-14).

## 39. Una consola local lanza el ejecutor y el cuaderno desde el panel

> Resuelve la decision pendiente de la 38. Tomada por el responsable del
> proyecto el 23 de septiembre de 2026 (RM-17), con la condicion de que la
> historia HU-MET-14 se redactara de nuevo para admitirla.

Contexto: la decision 38 dejo el panel de solo lectura porque HU-MET-14 lo
exigia, y dejo escrito que lanzar corridas desde el panel requeria decision. El
responsable pidio poder elegir la arquitectura, correr y observar el resultado
desde `localhost:4200`, sin abrir una terminal.

Decision: se agrega `apps/consola-experimento` (NestJS, puerto 3030, solo
`127.0.0.1`), que lanza **uno a la vez** (RM-04) los mismos comandos del README
de `experiment/`: `uv run python -u -m ejecutor correr ...`, `uv run papermill
...` sobre una corrida existente y `ejecutor indice` al terminar. Transmite la
salida por SSE (`RUTAS_CONSOLA` en `libs/contratos`) y permite cancelar el arbol
de procesos. El panel (pestaña "Correr una corrida") valida la seleccion con la
misma regla que arma la linea para la terminal, la envia a la consola y sigue
el progreso leyendo los renglones que ya escribe el ejecutor (`3/40 OK
T-COM-001 B0 r1 ok`); al terminar ofrece calcular los resultados con el
cuaderno y Resultados se vuelve a leer. La URL de la consola llega por
`consolaUrl` en `config.json` o `?consola=`. HU-MET-14 se redacto de nuevo: el
panel sigue sin poder modificar trazas, resultados ni configuracion; lo unico
que puede hacer es arrancar, por la consola, lo mismo que haria una persona en
la terminal.

Por que: separar la consola del panel y del backend conserva las dos garantias
que importan. Primera, una corrida lanzada desde el panel es identica a una
lanzada a mano (misma `corrida.yaml`, mismo `config_hash`, mismos artefactos):
la consola no tiene ninguna opcion que la terminal no tenga. Segunda, ninguna
cifra se calcula fuera del cuaderno (RM-02): la consola solo reenvia lineas y
el panel solo las lee. Escuchar en `127.0.0.1`, validar cada argumento contra
una forma cerrada y lanzar sin interprete de comandos acota el riesgo de tener
un servicio que arranca procesos.

La consola tambien sirve, de solo lectura, los archivos de `datos-experimento/`
(tareas, `corrida.yaml`, `salidas/`, `corridas/`) y en desarrollo el servidor
de Angular se los reenvia (`apps/web/proxy.conf.json`): si esos directorios
fueran assets del `serve`, el dev server recargaria la pagina con cada traza
que escribe el ejecutor y cortaria el seguimiento en vivo. En produccion siguen
siendo assets copiados al construir (decision 38).

Consecuencias: la consola es una herramienta de desarrollo sin imagen Docker;
si no responde, el panel muestra el comando para la terminal y, en desarrollo,
no puede leer los archivos del experimento hasta que se levante. Correr desde el panel no exime de congelar la
configuracion antes de la corrida oficial (RM-13). La redaccion original de
HU-MET-14 queda anotada en la propia historia.

## 40. B0 pasa a gpt-5.5-2026-04-23 con esfuerzo de razonamiento `none`

> Reemplaza la eleccion de modelo de la decision 23 (los demas parametros de
> esa decision siguen vigentes). Tomada por el responsable del proyecto el 23 de
> septiembre de 2026 (RM-17): "modifica el modelo por uno mucho mas superior".

Contexto: con `gpt-5.4-mini-2026-03-17` y el prompt base 1.3.0, B0 se estanco en
33 de 40 tareas en cinco corridas (±3 de ruido), con cuatro fallos estables que
no se resolvian con mas texto en el prompt
(`apps/b0-directo/docs/LINEA-BASE-B0-2026-09-23-gpt-5.4-mini.md`). El modelo es una
variable controlada del experimento (RNF-01, RNF-08): cambiarlo es una decision
registrada, no un ajuste.

Decision: `UNIHELP_MODELO_ID=gpt-5.5-2026-04-23`, el modelo general mas capaz con
fecha de snapshot disponible en la cuenta del proyecto (los `gpt-5.6-*` no tienen
snapshot y `gpt-5.5-pro` no es comparable en costo ni latencia). Se conserva
`temperature 0.2`, `top_p 1`, `max_completion_tokens 2048` y
`parallel_tool_calls: false` (decision 23, docs/07). Para que el proveedor acepte
esa temperatura y las herramientas en Chat Completions, B0 envia ahora
`reasoning_effort` de forma explicita, configurable con
`UNIHELP_MODELO_ESFUERZO` (por defecto `none`); con `none` el modelo no gasta
tokens de razonamiento y la peticion es la misma que recibia el modelo anterior.
Un valor distinto de `none` entra en la clave del casete, asi que las grabaciones
existentes siguen valiendo. La linea base con el modelo anterior queda congelada
en el documento citado y en `experiment/resultados/2026-09-23-b0-gpt-5.4-mini/`.

Por que: la unica variable que cambia entre la linea base y las corridas nuevas
es el modelo. Mantener temperatura, herramientas y prompt permite atribuir la
diferencia al modelo y no a la configuracion. `reasoning_effort: none` es ademas
la unica combinacion que el proveedor admite con funciones en esta API; usar
razonamiento exigiria migrar a la API de respuestas y rompe la comparacion.

Consecuencias: el prompt base sigue en 1.3.0 hasta que una corrida con el modelo
nuevo justifique tocarlo; cualquier cambio posterior sube su version. El costo
por ejecucion sube (tarifa aun sin fijar, M4.7). La cache automatica del
proveedor sigue activa (D2 pendiente, decision 23). El manifiesto y cada traza
registran el modelo exacto, asi que las corridas de ambos modelos no se
confunden; el cuaderno se corre por separado sobre cada una.

## 41. El nucleo del agente unico y sus capacidades son librerias compartidas; cada arquitectura aporta solo el puerto

> Resuelve DP-07 y DP-16 de `apps/b0-directo/docs/ARQUITECTURA.md` para B0 y B1.
> Tomada al construir B1 (23 de septiembre de 2026) bajo el principio del encargo:
> B1 y B0 identicos en todo salvo el transporte de las capacidades.

Contexto: todo el agente (bucle, cliente del modelo, casetes, presupuesto,
instrumentacion, extractor, capa de conversacion y controladores) vivia dentro
de `apps/b0-directo`. Construir B1 exigia copiarlo, y H1 mide `P(B1) - P(B0)`:
cualquier diferencia entre dos copias entraria en ese numero sin poder
separarse despues (RNF-01).

Decision:

- `libs/agente-nucleo` (`@unihelp/agente-nucleo`, `arq:compartido`) contiene el
  nucleo completo del agente unico y `AgenteNucleoModule.forRoot({ identidad,
imports, puertoCapacidades })`. El bucle depende de la interfaz
  `PuertoCapacidades` (`listar()` e `invocar()`, declarada en
  `libs/herramientas`) y pide las capacidades al puerto ANTES de cada llamada
  al modelo. La traduccion al formato de function calling ocurre en un unico
  lugar (`aFunctionCalling`). La identidad del agente (servicio, protocolo,
  actor de auditoria) se deriva de la identidad de salud de cada app.
- `libs/capacidades` (`@unihelp/capacidades`) contiene la logica de las cinco
  capacidades (antes adaptadores de B0), un registro aditivo con notificacion
  de cambio, el invocador del receptor sobre `EjecutorCapacidad` y
  `CapacidadesLocales`, el puerto en proceso. Los esquemas siguen en
  `libs/herramientas`, fuente unica; la libreria no sabe nada de MCP ni de
  function calling.
- B0 enlaza `PUERTO_CAPACIDADES` con `CapacidadesLocales`; B1 con
  `CapacidadesMcp` (cliente MCP en `apps/b1-mcp-agente`). Ninguna otra pieza es
  propia de la arquitectura.
- El resultado de una capacidad se normaliza "como si hubiera viajado" (JSON:
  fechas ISO, sin `undefined`) tambien en B0, para que la traza y el ensamblado
  de la respuesta vean la misma forma en ambas.

Por que: es la unica forma de que la resta mida el transporte. Ademas B2 podra
reutilizar `CapacidadesLocales` y B3 el cliente MCP sin volver a escribirlos.

Consecuencias: `apps/b0-directo` queda con `main`, `entorno`, `salud` y el
cableado; sus pruebas se movieron con el codigo (cambiaron imports y la
construccion del bucle, que ahora recibe el puerto). El proceso de cada agente
sigue accediendo a PostgreSQL para lo que no son capacidades (turno literal,
botones, lecturas, rutas del ejecutor): DP-B1-01 de
`apps/b1-mcp-agente/docs/ARQUITECTURA.md`. `docs/arquitecturas.md` y los README
de las librerias describen el reparto.

## 42. El servidor MCP publica los JSON Schema del contrato tal cual y lleva la trazabilidad en cabecera y `_meta`

> Tomada al construir B1 (23 de septiembre de 2026). Registra la version del SDK
> y de la especificacion, como pide el encargo.

Contexto: docs/02 fija la especificacion MCP `2025-11-25`, transporte Streamable
HTTP, esquemas de entrada y salida, anotaciones, errores tipados y
`tools.listChanged: true`. Habia que decidir con que se construye y como viajan
la traza (HU-33) y la duracion del receptor (D5) que el protocolo no contempla.

Decision:

- `@modelcontextprotocol/sdk` **1.30.1**, que implementa `2025-11-25`
  (`LATEST_PROTOCOL_VERSION`). Se usa el `Server` de bajo nivel y no
  `McpServer`, porque este solo acepta esquemas Zod y aqui los JSON Schema de
  `DEFINICIONES_HERRAMIENTAS` se publican sin transformar: es lo que hace que
  `tools/list` y lo que B0 envia al modelo sean identicos (prueba de
  equivalencia en `apps/mcp-server/src/app/mcp/contrato.spec.ts`).
- Transporte Streamable HTTP **con estado** (una sesion por cliente) en `/mcp`,
  fuera de `/api`; sin autenticacion en el entorno experimental. Solo asi
  existe el flujo SSE por el que se emite `notifications/tools/list_changed`
  cuando `RegistroCapacidades` crece (HU-27).
- Lo que UniHelp agrega encima del protocolo vive en
  `libs/contratos/src/lib/mcp.contrato.ts`: la traza en la cabecera
  `x-trace-id` de cada peticion; `conversacionId` y `actor` en
  `_meta['unihelp/contexto']` de `tools/call`; en el resultado,
  `_meta['unihelp/duracion_ms']` (entrada -> salida del manejador, reloj
  monotono), `_meta['unihelp/estructurado']` (dato sin sanear para M3.1) y
  `_meta['unihelp/error']` (`{ codigo, mensaje }` con `isError: true`). El texto
  que ve el modelo es el mismo JSON que B0 pone en el rol de herramienta.
- `tools/list` se compara con la instantanea versionada
  `apps/mcp-server/contrato/tools-list.instantanea.json`; cambiar una
  herramienta exige regenerarla en el mismo commit (RM-12).
- No se exponen recursos ni plantillas de prompt (HU-28 fuera de la corrida).

Por que: publicar los esquemas sin reescribirlos y medir la duracion en el
receptor son las dos condiciones para que `B1 - B0` sea el costo del transporte
(RNF-01, D5, RM-05). `_meta` es el unico lugar del protocolo para datos que no
son para el modelo.

Consecuencias: una actualizacion del SDK que cambie `LATEST_PROTOCOL_VERSION` se
ve en el arranque y debe registrarse aqui. El limite de llamadas se aplica en
`mcp-server` (DP-B1-03). La duracion reportada incluye la construccion del
`CallToolResult`, fracciones de milisegundo que B0 no tiene (DP-B1-02).

## 43. El orquestador B3 implementa coordinacion A2A explicita sin bucle de AgenteNucleoModule

> **Sustituida por la decision 44** (25 de septiembre de 2026): el orquestador de
> B3 SI es el nucleo del agente, con modelo, y comparte con B2 el nucleo
> multiagente. Se conserva como registro de por que existio la version
> determinista de B3.
>
> Tomada al construir B3 (24 de septiembre de 2026). Registra la independencia de
> coordinacion de agentes distribuida segun la regla de oro del experimento y RM-17.

Contexto: B0 y B1 son un agente unico con bucle de function calling implementado
en `libs/agente-nucleo`. En B3 (A2A distribuido), el orquestador tiene un rol
esencialmente diferente: recibe la solicitud, clasifica el tipo de triaje (HU-02),
descubre a los especialistas dinamicamente por sus Agent Cards (`/.well-known/agent-card.json`, HU-29)
sin quemar URLs en el prompt (D-41), delega secuencialmente a traves del protocolo
Agent2Agent v1.0 sobre JSON-RPC 2.0 (`message/send`, HU-30, RM-04), gestiona la espera
de confirmacion de tickets como el estado nativo del protocolo `input-required` (HU-31),
y utiliza las herramientas de tickets en `mcp-server` con la cabecera `X-Agent-Id: orquestador` (HU-20).

Decision:

- `b3-a2a-orquestador` no importa ni instancia el bucle iterativo de `AgenteNucleoModule`.
  En su lugar, implementa un servicio dedicado `TriajeService` con maquina de estados A2A
  y ruteo tipado. El orquestador expone las mismas rutas REST de triaje (`/api/conversaciones`)
  con los mismos contratos compartidos (`@unihelp/contratos`), permitiendo que el frontend
  interactue de manera indistinguible.

Por que: el nucleo de B0/B1 asume un unico agente que consulta herramientas locales o MCP.
Obligar a B3 a forzar la coordinacion A2A dentro de ese mismo bucle contaminaria la variable
medida (la arquitectura de integracion distribuida) y enmascararia las transiciones de estado
formales (`submitted -> working -> input-required -> completed/failed`) exigidas por el
protocolo A2A v1.0.

Consecuencias: la simetria de contratos externos con el frontend se mantiene intacta
a traves de `@unihelp/contratos`, pero la logica de orquestacion interna es propia de B3,
respetando estrictamente la comparabilidad cientifica (H3, RNF-01).

## 44. B2 y B3 son agentes con modelo sobre el mismo nucleo; el orquestador y los especialistas comparten `libs/multiagente-nucleo` y cada arquitectura aporta solo el puerto de especialistas

> Tomada al construir B2 y completar B3 (25 de septiembre de 2026). Sustituye a la
> decision 43. Registra tres decisiones de medicion que tomo el equipo (RM-17):
> (a) el orquestador y los dos especialistas usan el modelo, con el mismo prompt
> base y el mismo cliente que B0 y B1; (b) en la traza, cada delegacion cuenta dos
> mensajes y el `agente` de cada llamada es el rol; (c) la duracion del receptor
> no se suma a `tool_exec_ms`, sino que se reparte en sus propios componentes.

Contexto: la primera version de B3 (decision 43) clasificaba con palabras clave
y componia la respuesta con plantillas: ningun agente usaba el modelo. `docs/01`
exige que las cuatro arquitecturas compartan "el mismo prompt base, el mismo
modelo" y `docs/03` describe a los especialistas como agentes. Comparar un
agente con modelo (B0, B1) contra un sistema de reglas (B3) habria mezclado la
variable medida (como se integran los agentes) con otra (si usan modelo). B2 no
existia. Ademas B3 no publicaba las rutas del ejecutor ni la de confirmacion por
boton, y no media tiempos, saltos ni tokens.

Decision:

- **Los tres agentes de B2 y B3 usan el modelo** (opcion elegida por el equipo
  entre "orquestador y especialistas con modelo" y "solo el orquestador"). Cada
  uno es el MISMO bucle de function calling de B0/B1 (`BucleAgente`), con el
  mismo cliente del modelo, los mismos casetes, el mismo presupuesto y el mismo
  instrumentador. El orquestador ES `AgenteNucleoModule` con tres diferencias
  declaradas: su prompt, su puerto de capacidades y su identidad en la traza.
- `libs/multiagente-nucleo` (`@unihelp/multiagente-nucleo`, `arq:compartido`)
  contiene todo lo que B2 y B3 comparten: el prompt del orquestador, los
  prompts de los especialistas, las dos habilidades de delegacion
  (`knowledge_lookup`, `incident_diagnosis`) tal como las ve el modelo, los
  esquemas de los artefactos (`politica_aplicable`, `diagnostico`), el agente
  especialista, su fabrica, el endpoint A2A del especialista, las Agent Cards,
  el puerto compuesto del orquestador (`CapacidadesOrquestador`: delegaciones
  mas herramientas de tickets por MCP con `X-Agent-Id: orquestador`) y
  `OrquestadorMultiagenteModule.forRoot`. Es el equivalente de
  `libs/agente-nucleo` para la pareja B2/B3 (decision 41).
- **La unica pieza por arquitectura es `PuertoEspecialistas`**: en B2,
  `EspecialistasEnProceso` invoca a los dos especialistas dentro del proceso
  (la tarea pasa por JSON, "como si hubiera viajado"); en B3, `EspecialistasA2a`
  los resuelve por `skills[].id` en el registro de descubrimiento y les envia
  `message/send` (JSON-RPC 2.0 sobre HTTP). La equivalencia B3/B2 de `docs/03`,
  seccion 7, se cumple por construccion.
- **El prompt del orquestador es un delta mecanico sobre `PROMPT_BASE`**
  (`componerPromptOrquestador`): una seccion nueva que explica que las dos
  herramientas de lectura son delegaciones, la sustitucion de sus nombres y del
  campo `motivo_sin_resultados`, y la supresion de la frase sobre el filtro
  `categoria`. Los prompts de los especialistas se componen con secciones
  enteras del base (`seccionPromptBase`). El delta esta publicado en
  `docs/prompt-diffs.md` y una prueba falla si el base pierde un fragmento del
  delta (docs/06, actividad 4.7).
- **El cliente MCP de B1 se movio a `libs/capacidades-mcp`** y gano el rol
  (`X-Agent-Id`) con filtro de `tools/list` por `PERMISOS_AGENTE` (docs/03, 5).
  B1 lo usa sin rol, sin cambio de comportamiento; los tres agentes de B2 y B3,
  con el suyo. Una sola implementacion evita que `B2 - B1` incluya una
  diferencia en el acceso a las herramientas.
- **Traza de una ejecucion multiagente.** El especialista devuelve en
  `metadata['unihelp/medicion']` de su tarea lo que midio de si mismo
  (`duracion_ms`, `llm_ms`, `tool_exec_ms`, `transport_ms`, `usage`,
  `tool_calls`). El instrumentador del orquestador FUSIONA: suma consumo y
  tiempos, renumera las llamadas del especialista a continuacion de las suyas
  (con `agente` = rol: `orquestador`, `conocimiento`, `diagnostico`, el mismo
  en B2 y B3), registra el salto en `a2a.hops[]` con
  `transport_ms = rtt - duracion_ms` (D5, RM-05) y cuenta **dos mensajes por
  delegacion** (solicitud y respuesta) en `a2a.mensajes_totales`, en proceso o
  por red (M4.5). La duracion del receptor NO entra en `tool_exec_ms`: ya esta
  repartida en su `llm_ms`, `tool_exec_ms`, `transport_ms` y residuo; sumarla
  otra vez haria negativa la resta de orquestacion (HU-MET-07). Los estados de
  la tarea (`submitted`, `working`, `input-required`, `completed`, `failed`,
  `rejected`) van a `a2a.estados[]`; `input-required` es el turno en que el
  orquestador propuso un ticket y espera (HU-31). `TrazaParcialDto` gana el
  campo `a2a` y el ejecutor lo copia tal cual; B0 y B1 entregan
  `{ mensajes_totales: 0 }`.
- Un especialista que no responde, o cuyo modelo o servidor MCP fallan, es
  `ErrorInfraestructura` en el orquestador: la ejecucion termina como
  `error_infraestructura`, se reejecuta y se excluye, nunca con un diagnostico
  inventado (RM-15; docs/03, 7, degradacion). Un especialista que no puede
  completar por otra causa (tiempo, limite, artefacto invalido) devuelve una
  tarea `failed` con motivo, que el modelo del orquestador recibe como error de
  herramienta y explica a la persona.

Por que: es la unica forma de que `B2 - B1` mida la coordinacion multiagente y
`B3 - B2` el transporte A2A (H3), con el mismo modelo, el mismo prompt base y la
misma medicion en las cuatro arquitecturas (RNF-01). Reutilizar el bucle no
contamina la variable: el bucle es infraestructura, como el cliente de OpenAI;
lo que cambia entre arquitecturas es que herramientas ve cada modelo y por
donde viajan.

Consecuencias: la decision 43 queda sustituida (el clasificador determinista y
`TriajeService` se retiraron). `AgenteNucleoModule.forRoot` admite `prompt` y
`agente`, y exporta `AtenderTurnoUseCase`, `InstrumentadorTrazas` y
`RepositorioConversaciones` para el endpoint A2A del orquestador. El orquestador
hereda del nucleo las rutas del ejecutor, los botones de tickets y las lecturas,
y B3 pasa a leer PostgreSQL para lo que no son capacidades, como B1
(DP-B1-01). Cada delegacion no cuenta contra el limite de 20 llamadas de
`mcp-server`, que si aplica a las llamadas de los tres agentes bajo la misma
traza. `libs/trazas` no cambia: `a2a.hops[]` y `a2a.estados[]` ya eran
objetos libres en el esquema.

## 45. B2 alcanza las herramientas por MCP, igual que B3

> Tomada al construir B2 (25 de septiembre de 2026). Resuelve la discrepancia
> "B2 y MCP" de la tabla de AGENTS.md a favor del anexo (`docs/01`). Decision
> de medicion del equipo (RM-17), entre "B2 usa MCP, igual que B3" y "B2 usa las
> herramientas en proceso, como B0".

Contexto: `docs/01` dice que B2 accede a las capacidades por el servidor MCP; el
profile `b2` de Compose no lo levantaba porque B2 era solo `/health`. Con B2 en
proceso (`CapacidadesLocales`) y B3 por MCP, `B3 - B2` habria sumado el costo
de MCP al de A2A y dejado de ser una ablacion limpia del transporte entre agentes.

Decision: los tres agentes de B2 usan `CapacidadesMcp` con su rol, exactamente
como los de B3. `dev:b2` y el profile `b2` levantan `mcp-server`. Los contrastes
quedan asi: `B1 - B0` = MCP; `B2 - B1` = coordinacion multiagente en proceso;
`B3 - B2` = transporte A2A (H3).

Consecuencias: B2 depende de `mcp-server` (su identidad de salud lo declara).
La fila "B2 y MCP" sale de la tabla de discrepancias y `docs/arquitecturas.md`
muestra el salto MCP en B2.

## 46. Un proveedor local por Ollama para correr el experimento sin costo de API

> Tomada por el responsable del proyecto el 25 de septiembre de 2026 (RM-17):
> "es necesario hacer las pruebas de este trabajo de grado con un agente local,
> puede ser un Ollama"; y, sobre el alcance: "no se va a modificar el prompt,
> simplemente se van a evaluar los mismos tests con diferentes modelos".
> Convive con las decisiones 23 y 40, que siguen fijando el modelo de OpenAI de
> las corridas con proveedor `openai`. Guia de instalacion, requisitos y
> recomendaciones en `docs/modelo-local-ollama.md`.

Contexto: cada corrida completa (40 tareas por arquitectura, varias
repeticiones) gasta presupuesto de API y depende de la disponibilidad del
proveedor. El trabajo de grado necesita poder repetir el experimento en una
maquina propia. Ollama sirve modelos abiertos por la misma API de Chat
Completions con function calling que ya usa `ClienteModelo`, asi que un
proveedor local no toca la variable medida: el bucle del agente, el prompt
base, las herramientas y los transportes MCP y A2A son los mismos.

Decision: el experimento evalua LOS MISMOS tests con distintos modelos. El
prompt base, las herramientas, las 40 tareas, la compuerta y el ejecutor no
cambian por modelo; lo unico que varia entre campañas es el modelo que
responde, y el modelo local es uno mas de ellos. Si un modelo falla ante ese
prompt, el fallo es un resultado, no un defecto a corregir con un prompt
propio: un prompt por modelo romperia la comparacion.

Para hacerlo posible, `UNIHELP_MODELO_PROVEEDOR` acepta `openai` u `ollama`. Con `ollama`
el cliente apunta a `UNIHELP_MODELO_URL_BASE` (por defecto
`http://localhost:11434/v1`) y no exige `OPENAI_API_KEY`, porque el servidor
local no autentica (el SDK recibe la cadena `ollama`). Nada mas cambia en la
peticion: `temperature 0.2`, `top_p 1`, `max_completion_tokens 2048`,
`parallel_tool_calls: false`, sin `reasoning_effort`. El modelo local del
experimento es `unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k`, construido con
`pnpm ollama:crear` desde `infra/ollama/Modelfile`: parte de la cuantizacion
fija `qwen2.5:7b-instruct-q4_K_M` (digest `845dbda0ea48` en Ollama 0.34.4; el
derivado queda con `ea2acca68908`; unos 4,7 GB, cabe entero en una GPU de
8 GB) y sube la ventana de contexto a 16 384 tokens, porque la ventana por
defecto de Ollama (4096) truncaria el prompt base y los esquemas de las cinco
herramientas sin avisar. Se eligio Qwen2.5 7B Instruct por soportar function
calling nativo en Ollama, responder bien en español y no tener modo de
razonamiento que infle tokens y latencia. Requisitos minimos de la maquina:
GPU con 8 GB de VRAM (o 16 GB de RAM para correr en CPU, solo como
comprobacion), 16 GB de RAM y 10 GB de disco; validado en una RTX 5060 Laptop
de 8 GB con Windows 11, donde una tarea tarda 5,4 s de mediana. En la interfaz, el proveedor local
aparece como la ficha `local` ("Agente local"), la unica disponible cuando el
backend arranca con `ollama`.

Por que: separar el proveedor del resto de la configuracion permite repetir
la matriz completa sin costo y sin red, y deja el identificador exacto del
modelo en cada traza (`model.provider: ollama`, `model.id`, RNF-08). Fijar la
cuantizacion y el contexto en un `Modelfile` versionado hace que el modelo sea
un artefacto reproducible y no una etiqueta movil.

Consecuencias: las cifras obtenidas con el modelo local son una campaña
aparte; nunca se mezclan ni se comparan sin una decision de medicion con las
de OpenAI (RM-17): un modelo de 7B no es equivalente a `gpt-5.5`. Los
contrastes entre arquitecturas dentro de una misma campaña (B1-B0, B2-B1,
B3-B2) si son validos, porque las cuatro miden con el mismo modelo local. La
latencia del modelo pasa a depender de la GPU de la maquina, no del proveedor.
Ollama reutiliza el prefijo del prompt en su cache KV y lo reporta en
`prompt_tokens_details.cached_tokens`, que la traza registra en
`cached_input_tokens` igual que con OpenAI; tampoco se puede desactivar por
peticion, asi que D2 sigue pendiente (decision 23). La tarifa (M4.7) es 0 de
verdad, pero el manifiesto sigue declarando `tarifa_configurada: false`. Los casetes del modelo local van a su propio
directorio (`experiment/casetes/<modelo>`); un casete grabado con OpenAI no
sirve para reproducir una corrida local ni al reves, porque la clave del
casete incluye el id del modelo.

## 47. Los resultados archivados del experimento se versionan en `experiment/resultados/`

> Tomada el 25 de septiembre de 2026 a pedido del responsable del trabajo de
> grado, tras la campaña de cuatro modelos: los datos crudos son la evidencia
> del estudio y no pueden depender de una sola maquina.

Contexto: la regla 9 de AGENTS.md decia que las trazas y los resultados del
experimento no se versionan, y `.gitignore` excluia `experiment/resultados/`.
Con 1 920 ejecuciones de la campaña de modelos (unos 18 MB de trazas,
puntuaciones y salidas del cuaderno), perderlos significaria repetir horas de
corrida y gasto de tokens, y ningun informe seria verificable desde el
repositorio.

Decision:

- `experiment/resultados/<fecha>-<nombre>/` **se versiona**. Cada carpeta lleva
  el manifiesto del ejecutor (modelo por traza en `provenance.modelo_id`,
  commit, semilla, `config_hash`), `trazas.jsonl`, `puntuaciones.jsonl`,
  `huellas-esperadas.json`, el `resultados.json` del cuaderno con su
  `manifiesto-cuaderno.json`, las tablas y las figuras. `resultados/README.md`
  explica cada archivo y como analizarlos; `resultados/indice.py` regenera
  `indice.md` con una fila por carpeta.
- `experiment/corridas/`, `experiment/salidas/` y `experiment/casetes/` siguen
  sin versionarse: son el area de trabajo y se regeneran. Archivar una corrida
  es copiarla a `resultados/` (lo hace `campana.py`).
- Sigue vigente que los datos son sinteticos (RNF-05): las conversaciones que
  traen las trazas son las de `docs/tasks`, nunca de personas reales.

Por que: la trazabilidad del experimento exige que cualquier cifra de un
informe se pueda rehacer desde archivos que esten en el mismo repositorio que
el codigo que los produjo, con el commit registrado en cada manifiesto.

Consecuencias: la regla 9 de AGENTS.md cambia de redaccion. El repositorio
crece unos pocos MB por corrida completa; si una corrida oficial con cinco
repeticiones lo hiciera inmanejable, se pasaria a Git LFS, como preveia
`docs/06` (actividad 7.10).

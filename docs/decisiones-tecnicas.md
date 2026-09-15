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

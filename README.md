# UniHelp

Sistema de triaje de incidentes universitarios implementado en **cuatro
arquitecturas de integracion de agentes** que se pueden comparar
experimentalmente. Trabajo de grado de Ingenieria de Sistemas.

El objetivo del repositorio no es un producto, es un **banco de pruebas**: la
misma funcionalidad se construye cuatro veces, cambiando unicamente como se
integran los agentes, para medir el efecto de esa decision arquitectonica.

> **Estado actual: B0 funcional, B1-B3 en esqueleto.** B0 ([`apps/b0-directo`](apps/b0-directo/docs/ARQUITECTURA.md))
> es un agente unico con function calling sobre OpenAI y cinco herramientas en
> proceso, y es el unico backend que responde el contrato que consume el frontend: consulta la base de conocimiento
> ([`libs/conocimiento`](libs/conocimiento/README.md)), propone y crea tickets solo
> con confirmacion explicita ([`libs/tickets`](libs/tickets/README.md)) y deja
> auditoria de solo agregar. B1, B2 y B3 solo responden su endpoint de salud; no
> hay MCP real ni A2A real. B0 todavia no persiste trazas del experimento
> (DP-09) y no corre en Docker (ver [B0 con el agente real](#b0-con-el-agente-real)).
> El sistema de metricas ([`experiment/`](experiment/README.md)) calcula las
> familias M1, M4 y M7 de extremo a extremo sobre una corrida **sintetica**.

---

## Las cuatro arquitecturas

| Arq.   | Agentes | Protocolo de integracion | Distribuida | Descripcion                                                                           |
| ------ | ------- | ------------------------ | ----------- | ------------------------------------------------------------------------------------- |
| **B0** | uno     | ninguno (directo)        | no          | Linea base: el agente invoca la API del dominio directamente.                         |
| **B1** | uno     | MCP                      | no          | El mismo agente consume las capacidades como herramientas de un servidor MCP.         |
| **B2** | varios  | en proceso               | no          | Agentes especializados que se coordinan en memoria, sin protocolo de red entre ellos. |
| **B3** | varios  | A2A (Agent2Agent)        | si          | Cada especialista es un servicio independiente y se coordina via A2A.                 |

La variable que se manipula es **como se integran los agentes**. Todo lo demas
(dominio, contratos, frontend) se comparte, para que las diferencias medidas no
vengan de reimplementar el problema.

---

## Requisitos

| Herramienta    | Version | Para que                                     |
| -------------- | ------- | -------------------------------------------- |
| Node.js        | >= 22   | Ejecutar Nx y las apps en modo desarrollo    |
| pnpm           | >= 10   | Gestor de paquetes del workspace             |
| Docker Desktop | >= 24   | Levantar las arquitecturas con Compose       |
| uv             | >= 0.5  | Entorno Python 3.12 del analisis de metricas |

No se requiere ninguna credencial de pago para levantar el esqueleto.

```bash
# Si no tienes pnpm:
npm install --global pnpm@10
```

---

## Puesta en marcha

```bash
git clone <url-del-repositorio> unihelp
cd unihelp
pnpm setup          # instala todo el monorepo con un solo comando
```

---

## Levantar una arquitectura

Cada arquitectura es un **profile** de Docker Compose, asi que se levanta una a
la vez y se evalua aislada. No hay que tocar codigo para cambiar de una a otra.

### Con `--profile` (explicito)

```bash
# B0 - agente unico con integracion directa
docker compose -f infra/docker/docker-compose.yml --profile b0 up --build

# B1 - agente unico sobre servidor MCP
docker compose -f infra/docker/docker-compose.yml --profile b1 up --build

# B2 - multiagente en el mismo proceso
docker compose -f infra/docker/docker-compose.yml --profile b2 up --build

# B3 - multiagente distribuido sobre A2A
docker compose -f infra/docker/docker-compose.yml --profile b3 up --build
```

### Con los atajos de pnpm (equivalentes)

```bash
pnpm b0     # o pnpm b1 / pnpm b2 / pnpm b3
pnpm down   # detiene y limpia cualquier arquitectura que este corriendo
```

### Con UNA sola variable

```bash
cp infra/docker/.env.example infra/docker/.env
# editar COMPOSE_PROFILES=b2 en ese archivo
docker compose -f infra/docker/docker-compose.yml up --build
```

### Que levanta cada profile

| Profile        | Servicios                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------ |
| `b0`           | `b0-directo` + `web`                                                                       |
| `b1`           | `mcp-server` + `b1-mcp-agente` + `web`                                                     |
| `b2`           | `b2-multiagente-local` + `web`                                                             |
| `b3`           | `mcp-server` + `b3-a2a-orquestador` + `b3-a2a-conocimiento` + `b3-a2a-diagnostico` + `web` |
| `conocimiento` | `postgres` (base de conocimiento; aun no participa en `b0`..`b3`)                          |
| `simulacion`   | `postgres` + `simulador-servicios` (los cuatro sistemas emulados, en :3020)                |

---

## Verificar que arquitectura esta corriendo

Sea cual sea el profile, el backend de entrada queda publicado en el **mismo
puerto del host (3000)**. Por eso hay un solo frontend y su configuracion no
cambia entre arquitecturas.

| Que                    | Donde                                                |
| ---------------------- | ---------------------------------------------------- |
| Frontend               | <http://localhost:4200>                              |
| Salud del backend      | <http://localhost:3000/health>                       |
| Salud del servidor MCP | <http://localhost:3010/health> (profiles `b1`, `b3`) |

```bash
curl http://localhost:3000/health
```

```json
{
  "estado": "ok",
  "arquitectura": "B0",
  "servicio": "b0-directo",
  "rol": "agente-unico",
  "protocolo": "directo",
  "descripcion": "Agente unico que invoca la API del dominio directamente, sin protocolo de integracion intermedio.",
  "consumidoPor": ["B0"],
  "dependencias": [],
  "version": "0.1.0",
  "marcaTiempo": "2026-09-12T10:00:00.000Z",
  "tiempoActividadSegundos": 12
}
```

El campo `arquitectura` es la respuesta a "cual esta corriendo ahora mismo". El
frontend consulta este mismo endpoint y lo muestra en pantalla.

En `b3` los especialistas tambien se pueden inspeccionar por separado:
<http://localhost:3004/health> y <http://localhost:3005/health>.

---

## Desarrollo sin Docker

Nx permite levantar y probar cada app de forma independiente:

```bash
pnpm dev:b0     # nx serve b0-directo              -> :3000
pnpm dev:b1     # mcp-server + b1-mcp-agente       -> :3010, :3001
pnpm dev:b2     # nx serve b2-multiagente-local    -> :3002
pnpm dev:b3     # mcp-server + los tres de B3      -> :3010, :3003, :3004, :3005
pnpm dev:web    # nx serve web                     -> :4200

pnpm dev:simulador  # simulador de los sistemas universitarios -> :3020
```

En modo desarrollo cada app usa su propio puerto. Para apuntar el frontend a
otra arquitectura sin reconstruirlo, basta la query string:

```text
http://localhost:4200/?backend=http://localhost:3002
```

### B0 con el agente real

B0 necesita PostgreSQL (conocimiento, tickets y auditoria) y una clave de OpenAI.
La clave va SOLO en `apps/b0-directo/.env`, que git ignora; la plantilla es
[`apps/b0-directo/.env.example`](apps/b0-directo/.env.example).

```bash
pnpm conocimiento:db          # PostgreSQL 16 en :5432 (Docker)
pnpm conocimiento:preparar    # esquema y semilla de la base de conocimiento
pnpm tickets:migrar           # esquemas `tickets` y `auditoria`
cp apps/b0-directo/.env.example apps/b0-directo/.env   # y completar OPENAI_API_KEY
pnpm dev:web:b0               # B0 en :3000 + frontend contra el backend real en :4200
```

Desde **Configuración → Modelo de IA** se elige el proveedor y el modelo entre
los que habilita el servidor (`UNIHELP_MODELOS_PERMITIDOS`). La clave nunca sale
del servidor, y una corrida del experimento ignora esa eleccion (decision 27).

Para reproducir el estado de una tarea (docs/10, seccion 4) antes de probar hay
dos caminos: por linea de comandos,
`UNIHELP_PERFIL=experimento pnpm conocimiento:restablecer ma_fuera_parcial estandar`,
o por HTTP con el simulador de sistemas (ver mas abajo).

`pnpm b0` (Docker) todavia no sirve para B0: el contenedor no tiene la base
migrada ni las variables del modelo.

### El frontend siempre habla con un backend real

`pnpm dev:web` levanta solo la interfaz: necesita una arquitectura respondiendo
en `backendUrl` (hoy, B0). La capa de datos simulada se retiro cuando B0 empezo
a responder el contrato completo (decision 28); antes servia para construir el
frontend sin backend.

Para apuntar el frontend a otra arquitectura sin reconstruirlo:
`http://localhost:4200/?backend=http://localhost:3002`.

### Comandos de calidad

```bash
pnpm lint            # ESLint en los 12 proyectos
pnpm test            # pruebas unitarias (Jest)
pnpm build           # compila los 9 artefactos
pnpm verify          # lint + test + build de todo el workspace
pnpm format          # Prettier sobre los archivos afectados
pnpm graph           # grafo de dependencias del monorepo
```

### Simulador de los sistemas universitarios

Emula el aula virtual, el correo institucional, la autenticacion y la matricula:
los cuatro sistemas cuyo estado consultan las tareas de `docs/tasks`. No tiene
datos propios, publica los de `libs/conocimiento` (decision 33).

```bash
pnpm conocimiento:db && pnpm conocimiento:preparar
cp apps/simulador-servicios/.env.example apps/simulador-servicios/.env
pnpm dev:simulador                  # -> :3020   (o `pnpm simulador` en Docker)

curl http://localhost:3020/simulacion/salud              # los cuatro sistemas
curl -X POST http://localhost:3020/simulacion/estado-inicial   -H 'Content-Type: application/json'   -d '{"estadoInicial":"av_degradado_carga"}'            # conmuta de variante
```

Rutas, estados iniciales y limites en
[`apps/simulador-servicios/README.md`](apps/simulador-servicios/README.md).

### Base de conocimiento

```bash
pnpm conocimiento:db                # PostgreSQL 16 en :5432 (profile `conocimiento`)
pnpm conocimiento:migrar            # crea el esquema
pnpm conocimiento:sembrar           # carga la semilla (idempotente) e imprime la huella
pnpm conocimiento:test-integracion  # pruebas contra PostgreSQL real
```

Detalle, variables de entorno y restablecimiento en
[`libs/conocimiento/README.md`](libs/conocimiento/README.md).

### Ver las tareas en vivo

Con B0 y el frontend levantados, `pnpm visor` recorre las tareas de `docs/tasks` en un
Chrome visible: una persona simulada teclea cada turno y un panel lateral muestra los
tokens, la latencia y las herramientas que el backend midio, mas el veredicto de la
compuerta (calculado en Python). `pnpm visor -- --grep T-COM-001` corre una sola;
`pnpm visor:ui` abre el modo UI de Playwright. Detalle en
[`experiment/visor/README.md`](experiment/visor/README.md).

### Analisis de metricas

Ninguna metrica se calcula en TypeScript: todas salen de un unico cuaderno en
Python que escribe `experiment/salidas/resultados.json`.

```bash
pnpm analisis:desde-cero   # uv sync + corrida sintetica + cuaderno completo
pnpm analisis:test         # pruebas del sistema de metricas
```

Diseno, puntos de rechazo y contrato de resultados en
[`docs/sistema-de-metricas.md`](docs/sistema-de-metricas.md).

---

## Estructura del repositorio

```text
unihelp/
├── apps/
│   ├── b0-directo/              NestJS - B0: agente unico, integracion directa
│   ├── b1-mcp-agente/           NestJS - B1: agente unico que consume MCP
│   ├── b2-multiagente-local/    NestJS - B2: multiagente en el mismo proceso
│   ├── b3-a2a-orquestador/      NestJS - B3: orquestador A2A
│   ├── b3-a2a-conocimiento/     NestJS - B3: especialista A2A de conocimiento
│   ├── b3-a2a-diagnostico/      NestJS - B3: especialista A2A de diagnostico
│   ├── mcp-server/              NestJS - servidor de herramientas MCP (B1 y B3)
│   ├── simulador-servicios/     NestJS - emula los cuatro sistemas universitarios
│   └── web/                     Angular - frontend unico para las cuatro
├── libs/
│   ├── conocimiento/            Base de conocimiento (NestJS + TypeORM + PostgreSQL)
│   ├── contratos/               DTOs y esquemas tipados compartidos entre apps
│   ├── dominio/                 Tipos y vocabulario de dominio: servicios,
│   │                            estados, prioridades, catalogo de arquitecturas
│   ├── herramientas/            Contrato de las cinco herramientas, prompt base,
│   │                            validador, saneador y ejecutor de capacidades
│   ├── tickets/                 Propuesta, confirmacion con token, creacion,
│   │                            tabla de prioridad y auditoria de solo agregar
│   └── trazas/                  Validacion de trazas con AJV antes de persistir
├── experiment/                  Sistema de metricas (Python, uv)
│   ├── metricas.yaml            Registro de las 43 metricas
│   ├── schemas/                 Esquemas de traza, registro, insumos y resultados
│   ├── analisis/                Carga, inferencia y calculo por familia
│   ├── analisis.ipynb           Cuaderno unico: genera salidas/resultados.json
│   ├── fixtures/                Generador de corrida sintetica
│   ├── ejecutor/                Corre las 40 tareas contra una arquitectura
│   ├── visor/                   Playwright: las tareas en vivo, con panel de consumo
│   └── juez/                    Evaluacion automatica (futuro)
├── infra/
│   └── docker/                  Un Dockerfile por app + compose con profiles
├── docs/                        Documentacion tecnica y decisiones
├── nx.json                      Configuracion del workspace Nx
├── tsconfig.base.json           TypeScript estricto + alias @unihelp/*
├── eslint.config.mjs            ESLint compartido + limites entre arquitecturas
└── pnpm-workspace.yaml          Workspace de pnpm
```

### Para que sirve cada carpeta

- **`apps/b*`** — una app NestJS por arquitectura. Cada una es autonoma: se
  compila, se prueba y se despliega sin las otras tres.
- **`apps/mcp-server`** — servidor de herramientas MCP. Es transversal: lo
  consumen las arquitecturas que hablan MCP, no pertenece a ninguna.
- **`apps/simulador-servicios`** — emula los sistemas universitarios cuyo estado
  consulta UniHelp, uno por controlador, y conmuta entre los diez estados
  iniciales de las tareas. No tiene datos propios: publica los de
  `libs/conocimiento`, la misma fuente que leen los agentes.
- **`apps/web`** — **un solo** frontend Angular. Descubre la arquitectura activa
  consultando `/health`; la URL del backend llega por variable de entorno.
- **`libs/conocimiento`** — politicas versionadas, servicios y componentes como
  un grafo en PostgreSQL, con busqueda lexica determinista y restablecimiento
  verificable por huella. Compartida por los backends; el frontend no la importa.
- **`libs/contratos`** — el contrato que todas las apps cumplen. Garantiza que
  las cuatro arquitecturas se midan con la misma interfaz.
- **`libs/dominio`** — vocabulario del problema (areas de servicio, estados,
  prioridades) y catalogo de arquitecturas. Solo tipos y catalogos: la logica de
  triaje se implementa despues, por separado en cada arquitectura, porque es
  justamente lo que el experimento compara.
- **`libs/herramientas`** — el contrato de las cinco herramientas del agente y
  el prompt base, compartidos para que B0 y B1 envien al modelo exactamente lo
  mismo (RNF-01). Incluye la validacion de argumentos, el saneamiento del
  contenido recuperado y la medicion del lado del receptor.
- **`libs/tickets`** — registro controlado de tickets: la garantia de que sin
  token de confirmacion no hay escritura (HU-16) es el mismo codigo en todas las
  arquitecturas. Incluye la auditoria de solo agregar (HU-35).
- **`libs/trazas`** — valida cada traza contra `experiment/schemas/traza.schema.json`
  antes de persistirla; las invalidas van a cuarentena. Solo backends.
- **`experiment/`** — sistema de metricas: registro, validacion de trazas,
  remuestreo por tareas y el cuaderno unico que produce `resultados.json`.
- **`infra/docker/`** — un `Dockerfile.<app>` por aplicacion y el
  `docker-compose.yml` con los cuatro profiles.

---

## Como se garantiza el aislamiento entre arquitecturas

El requisito es que un tercero pueda evaluar una arquitectura sin que las otras
tres interfieran. Se sostiene en tres niveles:

1. **Aislamiento en ejecucion** — los profiles de Compose levantan solo los
   servicios de la arquitectura elegida. `docker compose --profile b2 up` no
   arranca nada de B0, B1 ni B3.
2. **Aislamiento de dependencias en la imagen** — cada Dockerfile copia
   unicamente `libs/` y su propia carpeta de `apps/`, y el `package.json` que
   emite `nx build` lista solo las dependencias que esa app realmente usa. La
   imagen de B0 no contiene dependencias de B1, B2 ni B3.
3. **Aislamiento en codigo, verificado por el linter** — cada proyecto lleva
   tags Nx (`arq:b0`, `arq:b1`, …) y la regla
   `@nx/enforce-module-boundaries` solo permite que una arquitectura importe de
   `arq:compartido`. Si alguien importa codigo de otra arquitectura, `pnpm lint`
   falla. El aislamiento no es una convencion: es una regla que rompe el build.

En el nivel de desarrollo el workspace comparte un solo `node_modules` (asi
funciona un monorepo Nx con pnpm, y es lo que mantiene una unica version de
NestJS y Angular para las cuatro). El aislamiento de dependencias se materializa
al construir las imagenes, que es el artefacto que se evalua.

---

## Convenciones

- **TypeScript estricto** en todo el repositorio (`strict: true` y compañia en
  `tsconfig.base.json`).
- **Alias de importacion**: `@unihelp/contratos`, `@unihelp/dominio` y
  `@unihelp/conocimiento` (solo backends).
- **Endpoint de salud** en `/health`, fuera del prefijo `/api` que usara el
  resto de la API.
- **Nombres de dominio en español**, nombres de framework en su idioma original
  (`Controller`, `Module`, `Injectable`).
- **Prettier + ESLint** compartidos desde la raiz.

---

## Documentacion

- [`docs/arquitecturas.md`](docs/arquitecturas.md) — detalle de las cuatro
  arquitecturas, topologia de servicios y mapa de puertos.
- [`docs/decisiones-tecnicas.md`](docs/decisiones-tecnicas.md) — decisiones de
  ingenieria tomadas al inicializar el monorepo y por que.

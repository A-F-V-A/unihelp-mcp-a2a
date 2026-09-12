# UniHelp

Sistema de triaje de incidentes universitarios implementado en **cuatro
arquitecturas de integracion de agentes** que se pueden comparar
experimentalmente. Trabajo de grado de Ingenieria de Sistemas.

El objetivo del repositorio no es un producto, es un **banco de pruebas**: la
misma funcionalidad se construye cuatro veces, cambiando unicamente como se
integran los agentes, para medir el efecto de esa decision arquitectonica.

> **Estado actual: esqueleto.** Cada arquitectura levanta una app NestJS que ya
> responde su endpoint de salud, y el frontend Angular muestra cual esta activa.
> Todavia no hay logica de triaje, base de datos, MCP real ni A2A real.

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

| Herramienta    | Version | Para que                                  |
| -------------- | ------- | ----------------------------------------- |
| Node.js        | >= 22   | Ejecutar Nx y las apps en modo desarrollo |
| pnpm           | >= 10   | Gestor de paquetes del workspace          |
| Docker Desktop | >= 24   | Levantar las arquitecturas con Compose    |

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

| Profile | Servicios                                                                                  |
| ------- | ------------------------------------------------------------------------------------------ |
| `b0`    | `b0-directo` + `web`                                                                       |
| `b1`    | `mcp-server` + `b1-mcp-agente` + `web`                                                     |
| `b2`    | `b2-multiagente-local` + `web`                                                             |
| `b3`    | `mcp-server` + `b3-a2a-orquestador` + `b3-a2a-conocimiento` + `b3-a2a-diagnostico` + `web` |

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
```

En modo desarrollo cada app usa su propio puerto. Para apuntar el frontend a
otra arquitectura sin reconstruirlo, basta la query string:

```text
http://localhost:4200/?backend=http://localhost:3002
```

### Comandos de calidad

```bash
pnpm lint            # ESLint en los 10 proyectos
pnpm test            # pruebas unitarias (Jest)
pnpm build           # compila los 8 artefactos
pnpm verify          # lint + test + build de todo el workspace
pnpm format          # Prettier sobre los archivos afectados
pnpm graph           # grafo de dependencias del monorepo
```

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
│   └── web/                     Angular - frontend unico para las cuatro
├── libs/
│   ├── contratos/               DTOs y esquemas tipados compartidos entre apps
│   └── dominio/                 Tipos y vocabulario de dominio: servicios,
│                                estados, prioridades, catalogo de arquitecturas
├── experiment/                  Arnes experimental (vacio por ahora)
│   ├── ejecutor/                Corredor de casos contra las cuatro arquitecturas
│   ├── trazas/                  Trazas crudas de cada corrida
│   └── juez/                    Evaluacion automatica y metricas
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
- **`apps/web`** — **un solo** frontend Angular. Descubre la arquitectura activa
  consultando `/health`; la URL del backend llega por variable de entorno.
- **`libs/contratos`** — el contrato que todas las apps cumplen. Garantiza que
  las cuatro arquitecturas se midan con la misma interfaz.
- **`libs/dominio`** — vocabulario del problema (areas de servicio, estados,
  prioridades) y catalogo de arquitecturas. Solo tipos y catalogos: la logica de
  triaje se implementa despues, por separado en cada arquitectura, porque es
  justamente lo que el experimento compara.
- **`experiment/`** — arnes de medicion. Vacio por ahora.
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
- **Alias de importacion**: `@unihelp/contratos` y `@unihelp/dominio`.
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

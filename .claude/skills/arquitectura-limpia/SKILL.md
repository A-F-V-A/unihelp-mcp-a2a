---
name: arquitectura-limpia
description: Como aplicar Clean Architecture en UniHelp. Usar al crear o modificar cualquier cosa en apps/web (modelos, puertos, casos de uso, stores, repositorios http/mock, mappers, componentes) o al estructurar logica nueva en una app de backend NestJS. Incluye la receta paso a paso para agregar una capacidad de punta a punta y la checklist de revision.
---

# Arquitectura limpia en UniHelp

Leer antes: `AGENTS.md` (reglas generales), la decision 14 de
`docs/decisiones-tecnicas.md` y la historia de usuario que implementas en
`docs/08-historias-de-usuario.md` (criterios de aceptacion). Si el cambio toca
`libs/`, leer tambien la skill `contratos-y-dominio`. Para backends de B1-B3,
`docs/02-servidor-mcp.md` y `docs/03-agentes-a2a.md`.

## 1. Idea central

Las dependencias apuntan **hacia adentro**. El dominio no sabe que existe
Angular, HTTP ni la simulacion; la infraestructura se adapta al dominio y no al
reves.

```text
presentation ──> application ──> domain <── infrastructure
                                   │
                                   └──> @unihelp/dominio, @unihelp/contratos (solo tipos)
```

| Capa              | Contiene                                                          | Puede importar                                   | Nunca importa                      |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| `domain/`         | `models/`, `rules/`, `errors/`, `ports/`                          | `@unihelp/dominio`, `@unihelp/contratos` (tipos) | Angular, RxJS, cualquier otra capa |
| `application/`    | `di/tokens.ts`, `use-cases/`, `state/` (stores signals)           | `domain/`, `@angular/core`                       | `infrastructure/`, `environments/` |
| `infrastructure/` | `http/`, `mock/`, `browser/`, `mappers/`, `provide-data-layer.ts` | todo lo anterior + `@unihelp/contratos`          | `presentation/`                    |
| `presentation/`   | componentes, pipes y utilidades de vista                          | `application/`, `domain/`                        | `infrastructure/`, `environments/` |

Las restricciones de `domain/`, `application/` y `presentation/` estan en
`apps/web/eslint.config.mjs` y rompen `pnpm nx lint web`. **No las relajes ni
uses `eslint-disable` para saltarlas**: si un import no pasa, el diseño esta
mal.

## 2. Responsabilidad de cada pieza

- **Modelo** (`domain/models/x.ts`): interfaces `readonly` con tipos ricos
  (`Date`, uniones de `@unihelp/dominio`). No es el DTO: el DTO es la forma de
  la red, el modelo es la forma que le conviene a la app.
- **Regla** (`domain/rules/x.rules.ts`): funciones puras y sincronas.
  Validaciones y decisiones que no dependen del backend. Faciles de probar.
- **Error** (`domain/errors/error-backend.ts`): `ErrorBackend` es el **unico**
  error que cruza la frontera de los repositorios. HTTP y mock traducen sus
  fallos a el; nadie aguas arriba sabe de donde vino.
- **Puerto** (`domain/ports/x.repository.ts` o `x.port.ts`): interface con
  metodos que devuelven `Promise<Modelo>`. Documenta que garantiza cada metodo.
- **Token** (`application/di/tokens.ts`): `InjectionToken<Puerto>`. Los puertos
  son interfaces y no existen en runtime; el token es lo que se inyecta.
- **Caso de uso** (`application/use-cases/x.use-case.ts`): una clase, un
  metodo `ejecutar()`. Orquesta reglas de dominio + puerto. Sin estado.
- **Store** (`application/state/x.store.ts`): estado de la vista con `signal`
  y `computed`. Llama casos de uso, convierte `ErrorBackend` en `ErrorVista`.
- **Mapper** (`infrastructure/mappers/x.mapper.ts`): funciones `mapearX(dto)`
  DTO -> modelo. Lo usan **tanto** HTTP como mock.
- **Repositorio HTTP** (`infrastructure/http/http-x.repository.ts`): implementa
  el puerto con `ClienteApi` y `RUTAS_API`, arma el DTO de entrada, mapea la
  salida.
- **Repositorio mock** (`infrastructure/mock/mock-x.repository.ts`): implementa
  el mismo puerto; produce **los mismos DTOs del contrato** via `SimuladorRed` y
  `BaseDatosSimulada`, y los pasa por **el mismo mapper**. Errores con
  `falloApi(codigo, mensaje, detalles)`. Datos en `mock/fixtures/`.
- **`provideDataLayer`**: unico lugar que decide mock o real
  (`segunBackend(TOKEN, Mock, Http)`).
- **Componente** (`presentation/.../x/x.ts` + `.html` + `.css`): standalone,
  `ChangeDetectionStrategy.OnPush`, `input()`/`output()`, selector `app-`.
  Obtiene datos del store o de casos de uso; no conoce repositorios.

## 3. Receta: agregar una capacidad de punta a punta

Ejemplo canonico a imitar: **tickets**. Abrelo antes de escribir.

| Paso | Archivo de ejemplo                                                   |
| ---- | -------------------------------------------------------------------- |
| 0    | `libs/contratos/src/lib/ticket.contrato.ts`, `api.contrato.ts`       |
| 1    | `apps/web/src/app/domain/models/ticket.ts`                           |
| 2    | `apps/web/src/app/domain/rules/propuesta.rules.ts`                   |
| 3    | `apps/web/src/app/domain/ports/ticket.repository.ts`                 |
| 4    | `apps/web/src/app/application/di/tokens.ts`                          |
| 5    | `apps/web/src/app/application/use-cases/proponer-ticket.use-case.ts` |
| 6    | `apps/web/src/app/infrastructure/mappers/ticket.mapper.ts`           |
| 7    | `apps/web/src/app/infrastructure/http/http-ticket.repository.ts`     |
| 8    | `apps/web/src/app/infrastructure/mock/mock-ticket.repository.ts`     |
| 9    | `apps/web/src/app/infrastructure/provide-data-layer.ts`              |
| 10   | `apps/web/src/app/application/state/conversacion.store.ts`           |
| 11   | `apps/web/src/app/presentation/chat/components/ticket-created-card/` |

**Paso 0 — Contrato primero.** Si la capacidad viaja por la red, se define en
`libs/contratos` (DTOs + ruta en `RUTAS_API`) y el vocabulario nuevo en
`libs/dominio`. Ver skill `contratos-y-dominio`. El frontend se construye contra
el contrato; el backend lo implementara despues tal cual.

**Paso 1 — Modelo.**

```ts
import type { AreaServicio } from '@unihelp/dominio';

export interface Encuesta {
  readonly id: string;
  readonly servicio: AreaServicio;
  readonly respondidaEn: Date | null;
}
```

**Paso 2 — Reglas** (solo si hay decisiones locales). Funciones puras + spec.

**Paso 3 — Puerto.**

```ts
/** Puerto de encuestas de satisfaccion (HU-xx). Rechaza solo con `ErrorBackend`. */
export interface EncuestaRepository {
  /** Que garantiza y que NO hace este metodo. */
  obtenerEncuesta(ticketNumero: string): Promise<Encuesta>;
}
```

**Paso 4 — Token.**

```ts
export const ENCUESTA_REPOSITORY = new InjectionToken<EncuestaRepository>('ENCUESTA_REPOSITORY');
```

**Paso 5 — Caso de uso.**

```ts
/** Una linea: que hace y que nunca hace. */
@Injectable({ providedIn: 'root' })
export class ObtenerEncuestaUseCase {
  private readonly encuestas = inject(ENCUESTA_REPOSITORY);

  ejecutar(ticketNumero: string): Promise<Encuesta> {
    return this.encuestas.obtenerEncuesta(ticketNumero);
  }
}
```

**Paso 6 — Mapper.** `mapearEncuesta(dto: EncuestaDto): Encuesta`. Convierte
ISO -> `Date`; nada mas.

**Paso 7 — Repositorio HTTP.** `@Injectable()` (sin `providedIn`), implementa el
puerto, usa `RUTAS_API` y el mapper. No atrapa errores: `ClienteApi` ya los
traduce a `ErrorBackend`.

**Paso 8 — Repositorio mock.** `@Injectable()`, mismo puerto, responde con
`this.red.responder('nombreOperacion', () => ...)` construyendo el **DTO** y
luego lo mapea. Agrega los datos a `mock/fixtures/` (tipados) y, si aplica, un
escenario en `escenarios.fixture.ts`.

**Paso 9 — Registro.** En `provideDataLayer`: agrega ambas clases a la lista y
`segunBackend(ENCUESTA_REPOSITORY, MockEncuestaRepository, HttpEncuestaRepository)`.

**Paso 10 — Estado.** Si la vista necesita estado, amplia el store existente o
crea `x.store.ts` con signals. Los errores se exponen como `ErrorVista`.

**Paso 11 — Componente.** Standalone, OnPush, `input.required<Modelo>()`,
`computed` para derivar etiquetas (usa `presentation/shared/formato.ts`).

**Paso 12 — Pruebas.** Spec de reglas, del caso de uso o store, del mapper y de
ambos repositorios (ver `http-repositories.spec.ts` y
`mock-repositories.spec.ts`).

**Paso 13 — Validar.** `pnpm nx lint web`, `pnpm nx test web`, `pnpm nx build
web` y validacion en navegador (camino feliz, error con `?simular-error=...`,
ancho 400px).

## 4. Errores: flujo completo

```text
HTTP 4xx/5xx o timeout ──> ClienteApi / http-error.mapper ──┐
falloApi() en el mock ─────> SimuladorRed ──────────────────┤
                                                            ▼
                                                     ErrorBackend (domain)
                                                            ▼
                                     caso de uso / store: normalizarError()
                                                            ▼
                                            ErrorVista (signal) ──> componente
```

Nunca propagues `HttpErrorResponse`, `Error` generico ni strings hacia arriba.

## 5. Backends NestJS (convencion para cuando llegue la logica)

Hoy solo existe `src/app/salud/`. Cuando una arquitectura implemente triaje,
aplica las mismas capas **dentro de esa app** (nunca compartidas entre
arquitecturas, porque son la variable del experimento):

```text
apps/bX-.../src/app/<capacidad>/
  domain/          modelos, reglas y puertos propios de esta arquitectura
  application/     casos de uso / coordinacion de agentes
  infrastructure/  adaptadores: LLM, cliente MCP, cliente A2A, persistencia
  presentation/    controllers que exponen EXACTAMENTE RUTAS_API y DTOs de @unihelp/contratos
  <capacidad>.module.ts
```

- Los controllers devuelven tipos de `@unihelp/contratos`; errores con la forma
  `ErrorApiDto` y el status HTTP de la tabla de `api.contrato.ts`.
- `/health` queda fuera de `/api` (decision 6).
- Esta estructura es una **propuesta**: al implementarla por primera vez,
  registrala como decision en `docs/decisiones-tecnicas.md`.

## 6. Anti-patrones (rechazar en revision)

- Inyectar `HttpTicketRepository` o `MockXRepository` en un componente, store o
  caso de uso.
- Leer `environment` o `USE_MOCK_BACKEND` fuera de `provideDataLayer`.
- Usar el DTO como modelo en `presentation/` (fechas `string`, campos de red).
- Logica de negocio en un componente o en un mapper.
- Un mock que devuelve modelos directamente sin pasar por DTO + mapper.
- `if (mock) ... else ...` en cualquier parte.
- Mover logica de triaje a `libs/` "para reutilizarla" entre arquitecturas.

## 7. Checklist antes de dar por terminado

- [ ] Ningun import cruza capas en direccion prohibida (`pnpm nx lint web` limpio).
- [ ] El puerto documenta sus garantias; los errores son `ErrorBackend`.
- [ ] HTTP y mock implementan el mismo puerto y usan el mismo mapper.
- [ ] Registrado en `provideDataLayer` con `segunBackend`.
- [ ] Specs de reglas, casos de uso/store, mapper y repositorios.
- [ ] Referencias `HU-xx` en los JSDoc donde aplique.
- [ ] Validado en navegador (feliz, error, movil) o explicado por que no.

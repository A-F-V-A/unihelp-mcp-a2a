# simulador-servicios

Emula los **sistemas universitarios** cuyo estado de salud consulta UniHelp.

En el caso de uso real serían cuatro sistemas distintos, cada uno operado por su
dependencia y con su propio endpoint de salud. Aquí no existen: los emula este
backend, con **un controlador por sistema**, publicando el estado que declara la
tarea en curso en su bloque `estado_inicial.servicios`
([`docs/tasks/*.yaml`](../../docs/tasks)).

> **No es una fuente de datos paralela.** La única fuente sigue siendo
> [`libs/conocimiento`](../../libs/conocimiento/README.md) sobre PostgreSQL, la
> misma que leen los agentes. Este backend solo la publica por HTTP y permite
> conmutar entre estados iniciales (decisión 33). Por eso la huella de HU-36
> sigue cubriendo todo lo que el simulador muestra.

Tampoco participa del triaje: no clasifica, no calcula prioridad, no estima una
ventana que el sistema no publicó (HU-10) y no interpreta el comunicado.

---

## Los cuatro sistemas emulados

Son exactamente los que consultan las 40 tareas del conjunto de evaluación.

| Código                 | Nombre                      | Área                 | Nivel       | Ruta propia                              |
| ---------------------- | --------------------------- | -------------------- | ----------- | ---------------------------------------- |
| `aula_virtual`         | Aula virtual                | `plataforma-virtual` | alto        | `/simulacion/aula-virtual/salud`         |
| `autenticacion`        | Autenticación institucional | `soporte-tecnico`    | **crítico** | `/simulacion/autenticacion/salud`        |
| `correo_institucional` | Correo institucional        | `soporte-tecnico`    | alto        | `/simulacion/correo-institucional/salud` |
| `matricula`            | Matrícula en línea          | `registro-academico` | alto        | `/simulacion/matricula/salud`            |

`autenticacion` y `correo_institucional` comparten área. Por eso la ruta del
contrato de triaje (`GET /api/servicios/:area/estado`, que identifica el
servicio por **área** y devuelve el más afectado) no los distingue, y las rutas
de este simulador sí: el bloque `estado_inicial.servicios` de una tarea habla de
los cuatro sistemas por separado.

## Los diez estados iniciales

Los define la semilla de `libs/conocimiento` y son los diez `overlay` que usan
las tareas. Entre paréntesis, cuántas tareas parten de cada uno.

| Código                          | Deja afectado          | Tareas |
| ------------------------------- | ---------------------- | ------ |
| `todo_operativo`                | ninguno                | 18     |
| `av_degradado_carga`            | `aula_virtual`         | 7      |
| `au_degradado_total`            | `autenticacion`        | 3      |
| `ci_fuera_parcial`              | `correo_institucional` | 3      |
| `av_mantenimiento`              | `aula_virtual`         | 2      |
| `au_fuera_total`                | `autenticacion`        | 2      |
| `ma_mantenimiento`              | `matricula`            | 2      |
| `au_degradado_total_envenenado` | `autenticacion`        | 1      |
| `ci_degradado_filtros`          | `correo_institucional` | 1      |
| `ma_fuera_parcial`              | `matricula`            | 1      |

`au_degradado_total_envenenado` es el de `T-ADV-007`: su comunicado trae una
instrucción incrustada. El simulador lo entrega **sin sanear**, porque sanearlo
aquí borraría justamente lo que esa tarea mide. Aquí el comunicado es la salida
de un sistema externo, no la entrada de un modelo: delimitarlo antes de ponerlo
en un prompt es responsabilidad de quien lo consume, como ya hace el adaptador
de `consultar_estado_servicio` de B0.

---

## Levantarlo

Necesita PostgreSQL con la base de conocimiento sembrada.

```bash
pnpm conocimiento:db          # PostgreSQL 16 en localhost:5432
pnpm conocimiento:preparar    # migrar + sembrar (deja todo_operativo)

cp apps/simulador-servicios/.env.example apps/simulador-servicios/.env
pnpm dev:simulador            # -> http://localhost:3020
```

En Docker, junto con la base:

```bash
pnpm simulador                # profile `simulacion`: postgres + simulador
```

Vive en su propio profile y no en `b0`..`b3` a propósito: las arquitecturas leen
el estado de servicios **en proceso** desde la librería, no por HTTP. Meterlo en
sus profiles daría a entender que forma parte de la topología que se mide.

## Rutas

Todas fuera del prefijo `/api`, igual que `/health` y `/experimento/*`
(decisiones 6 y 32): `/api` es el contrato de triaje que atiende el frontend y
ninguna de estas forma parte de él. Los tipos están en
[`simulacion.contrato.ts`](../../libs/contratos/src/lib/simulacion.contrato.ts).

| Ruta                                     | Qué devuelve                                                      |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `GET /health`                            | El contrato de salud común a las ocho apps de backend.            |
| `GET /simulacion/salud`                  | Los cuatro sistemas, con la forma de `estado_inicial.servicios`.  |
| `GET /simulacion/sistemas`               | El catálogo, sin estado.                                          |
| `GET /simulacion/sistemas/:codigo/salud` | Un sistema por código, con todos sus componentes.                 |
| `GET /simulacion/<sistema>/salud`        | Lo mismo, en la ruta propia de cada sistema.                      |
| `GET /simulacion/estados-iniciales`      | Las diez variantes de la semilla. No toca la base.                |
| `GET /simulacion/estado-inicial`         | Qué variante está cargada ahora.                                  |
| `POST /simulacion/estado-inicial`        | Conmuta de variante y devuelve la huella. **Perfil experimento.** |

### Conmutar el estado inicial

```bash
curl -X POST http://localhost:3020/simulacion/estado-inicial \
  -H 'Content-Type: application/json' \
  -d '{"estadoInicial":"av_degradado_carga"}'
```

Conmutar **borra y repuebla** la base de conocimiento, así que `POST` solo se
registra con `UNIHELP_PERFIL=experimento` (HU-36). Sin ese perfil el simulador
queda de solo lectura y esa ruta devuelve 404; los `GET` siguen respondiendo.

La huella que devuelve es la del estado escrito, calculada dentro de la misma
transacción, y coincide con la tabla de `calcularHuellasEsperadas`. Los `GET`
devuelven `huella: null` a propósito: una huella calculada fuera de esa
transacción es justamente la que no sirve para HU-36.

`corpus` es opcional y por defecto `estandar`. Las tres políticas envenenadas
solo entran con `"corpus":"adversarial"`, que es lo que piden las tareas
adversariales.

> Conmutar aquí **no** borra el estado en proceso de la arquitectura que esté
> corriendo (conversaciones, instrumentación, tickets). Eso lo sigue haciendo
> `POST /experimento/restablecer` en cada backend (decisión 32).

## Archivos

| Archivo                                                         | Qué hace                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/main.ts`                                                   | Arranque: prefijo `/api` con `/health` y `/simulacion/*` excluidos.      |
| `src/entorno.ts`                                                | Carga `.env` en desarrollo antes de leer la configuración.               |
| `src/app/app.module.ts`                                         | Une salud y simulación.                                                  |
| `src/app/salud/`                                                | `/health`. Idéntico a las otras apps salvo `identidad.ts`.               |
| `src/app/http/error-api.ts`                                     | `ErrorApi` y el status HTTP de cada código del contrato.                 |
| `src/app/http/filtro-errores.ts`                                | Traduce cualquier fallo a `ErrorApiDto`. Nunca devuelve traza de pila.   |
| `src/app/simulacion/simulacion.module.ts`                       | Registra los controladores; el conmutador solo en perfil experimento.    |
| `src/app/simulacion/sistemas-emulados.ts`                       | Los cuatro códigos y el catálogo, con la verificación contra la semilla. |
| `src/app/simulacion/salud-de-sistemas.ts`                       | La consulta, una sola vez para los cuatro sistemas.                      |
| `src/app/simulacion/mapeo-salud.ts`                             | Dominio -> DTO, con el vocabulario publicado.                            |
| `src/app/simulacion/controladores/panel.controller.ts`          | `/simulacion/salud`, `/sistemas`, `/sistemas/:codigo/salud`.             |
| `src/app/simulacion/controladores/estado-inicial.controller.ts` | Lectura y conmutación del estado inicial.                                |
| `src/app/simulacion/controladores/<sistema>.controller.ts`      | Un controlador por sistema emulado (cuatro).                             |

## Por qué la lista de sistemas está escrita en el código

`SISTEMAS_EMULADOS` enumera los cuatro códigos porque **cada sistema tiene su
propia ruta** y las rutas de NestJS son estáticas. No es una segunda fuente de
datos: el estado sale siempre de la base. Para que no se desincronice de la
semilla, `CatalogoSistemas` verifica en los dos sentidos al construir el
catálogo y falla si no coinciden:

- un sistema declarado que no está en la base sería una ruta que responde 500;
- un servicio en la base sin declarar sería un sistema que las tareas consultan
  y el simulador no emula.

Las dos situaciones rompen de inmediato, no en mitad de una corrida.

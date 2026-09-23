---
name: contratos-y-dominio
description: Como funcionan y como se modifican las librerias globales libs/contratos (@unihelp/contratos) y libs/dominio (@unihelp/dominio) de UniHelp. Usar antes de agregar o cambiar un DTO, una ruta de API, un codigo de error, un tipo de vocabulario, un catalogo o una constante compartida, y para decidir si algo debe vivir en libs o dentro de una app.
---

# Contratos y dominio: las librerias globales

Leer antes: `AGENTS.md`, `libs/contratos/README.md`, `libs/dominio/README.md`,
las decisiones 8 y 13 de `docs/decisiones-tecnicas.md` y, en el anexo,
`docs/01-arquitectura-y-funcionalidades.md` (modelo de dominio y contrato REST)
y `docs/02-servidor-mcp.md` (esquemas de herramientas). Si un tipo de las libs
no coincide con el anexo, no lo cambies en silencio: anotalo en
"Discrepancias conocidas" de `AGENTS.md` y pregunta.

## 1. Por que son globales y por que importa tanto

El experimento compara cuatro arquitecturas. Para que la comparacion sea justa,
las cuatro deben resolver **el mismo problema** con **la misma interfaz**. Las
dos librerias son exactamente eso:

- `@unihelp/contratos` = **la misma interfaz**: que rutas existen y que cuerpos
  viajan por la red.
- `@unihelp/dominio` = **el mismo problema**: el vocabulario con el que se
  describe (prioridades, areas, estados, clasificaciones, limites).

Las consumen **las ocho apps** (siete backends + `web`). Por eso un cambio aqui
es un cambio global: impacta a todas y debe ser deliberado.

Ambas llevan tags `tipo:lib, arq:compartido` y solo pueden depender de otras
librerias `arq:compartido`. `contratos` importa tipos de `dominio`; `dominio`
no importa nada.

```text
            @unihelp/dominio  (vocabulario)
                   ▲
            @unihelp/contratos (red)  ── importa tipos de dominio
                   ▲
   ┌───────┬───────┼────────┬──────────┬─────────┐
  web     b0      b1       b2         b3 (x3)   mcp-server
```

## 2. Donde va cada cosa (arbol de decision)

1. **¿Viaja por la red** (cuerpo de peticion/respuesta, ruta, codigo de error)?
   → `libs/contratos`.
2. **¿Es vocabulario compartido**: una lista cerrada de valores, un catalogo,
   un limite numerico, un identificador, que usan al menos dos proyectos?
   → `libs/dominio`.
3. **¿Es una decision o un algoritmo** (clasificar, priorizar, enrutar, elegir
   politicas, decidir si proponer ticket)?
   → **NO va en libs.** Va dentro de cada arquitectura, porque es la variable
   que se mide. Compartirla anula el estudio.
4. **¿Es una regla o forma que solo necesita el frontend** (validacion local,
   modelo con `Date`, formato de vista)?
   → `apps/web/src/app/domain/` o `presentation/shared/`.
5. **¿Es un detalle de una sola app** (identidad de salud, config de puerto)?
   → dentro de esa app.

### No confundir `libs/dominio` con `apps/web/src/app/domain/`

|          | `libs/dominio`                      | `apps/web/src/app/domain/`                               |
| -------- | ----------------------------------- | -------------------------------------------------------- |
| Alcance  | global (8 apps)                     | solo el frontend                                         |
| Contiene | tipos, constantes, catalogos        | modelos, reglas, errores, puertos                        |
| Logica   | ninguna                             | reglas puras del cliente (validar, cerrar propuesta)     |
| Ejemplo  | `PRIORIDADES`, `LONGITUD_SOLICITUD` | `validarSolicitud()`, `ErrorBackend`, `TicketRepository` |

La capa `domain/` del web **usa** el vocabulario de `libs/dominio`; no lo
redefine. Si ves un literal `'alta' | 'media'` escrito a mano en una app, debe
ser `Prioridad`.

## 3. Reglas de `libs/dominio`

- Solo `export type`, `export interface`, `export const` de datos. Sin clases,
  sin funciones con decisiones, sin efectos.
- Listas cerradas con el patron `as const` + tipo derivado, nunca `enum`:

  ```ts
  /** Que representa y donde se usa (HU-xx). */
  export const NIVELES_ESTADO_SERVICIO = [
    'operativo',
    'degradado',
    'interrumpido',
    'mantenimiento',
  ] as const;

  export type NivelEstadoServicio = (typeof NIVELES_ESTADO_SERVICIO)[number];
  ```

  El arreglo sirve para validar e iterar en runtime; el tipo, para compilar.

- Catalogos como `Readonly<Record<Clave, Descriptor>>` indexados por el tipo
  (ver `CATALOGO_AREAS_SERVICIO`): TypeScript obliga a cubrir todas las claves.
- Valores en kebab-case y en español (`'fuera-de-alcance'`, `'en-triaje'`).
- Constantes en `UPPER_SNAKE_CASE` y en plural para listas.
- Archivos por tema: `incidentes.ts`, `triaje.ts`, `arquitecturas.ts`. Un tema
  nuevo = archivo nuevo, exportado en `src/index.ts` y listado en el README.

## 4. Reglas de `libs/contratos`

- Un archivo `<recurso>.contrato.ts` por recurso de la API.
- Solo `interface`/`type` y constantes de rutas y codigos. Sin frameworks: nada
  de decoradores de NestJS (`class-validator`) ni tipos de Angular.
- Sufijo `Dto` en todo cuerpo de red: `TicketDto`, `SolicitarPropuestaTicketDto`.
  Excepcion historica: `RespuestaSalud` / `IdentidadServicio`.
- Todas las propiedades `readonly`; listas `readonly X[]`.
- Fechas como `string` con JSDoc `/** ISO 8601. */`. Nunca `Date` (no sobrevive
  a JSON).
- Opcionalidad explicita: prefiere `campo: T | null` a `campo?: T` para que el
  backend siempre envie el campo.
- Usa los tipos de `@unihelp/dominio` para campos cerrados (`prioridad:
Prioridad`), nunca `string`.
- Cada ruta nueva va en `RUTAS_API` con JSDoc: metodo, DTO de entrada ->
  DTO de salida y garantias (`{@link XDto}`). Rutas con parametros como
  funciones con `encodeURIComponent`.
- Codigos de error solo de `CODIGOS_ERROR_API`; si hace falta uno nuevo, se
  agrega a la lista **y** a la tabla de status HTTP del JSDoc.
- Invariantes de negocio que el tipo pueda expresar, se expresan en el tipo
  (ej.: `confirmacionExplicita: true` literal, HU-17).
- `/health` queda fuera de `/api` (decision 6).

## 5. Procedimiento para cambiar una libreria global

1. **Justifica** en que paso del arbol de decision cae el cambio.
2. **Clasifica el cambio**:
   - _Aditivo_ (tipo, ruta o campo opcional nuevo): bajo riesgo.
   - _Rompiente_ (renombrar, quitar, cambiar tipo, volver obligatorio,
     agregar un valor a una union que otros recorren con `switch`): requiere
     actualizar **todos** los consumidores en el mismo cambio.
3. **Edita la lib** siguiendo las reglas anteriores y exporta en `src/index.ts`.
4. **Actualiza los consumidores** que aplique:
   - `apps/web/.../domain/models/` (modelo equivalente)
   - `apps/web/.../infrastructure/mappers/` (mapper DTO -> modelo)
   - `apps/web/.../infrastructure/http/` (repositorio del puerto)
   - `apps/web/.../presentation/shared/formato.ts` (etiquetas de nuevos valores)
   - backends que ya implementen esa ruta (hoy: solo `/health`, en las siete
     apps: `apps/*/src/app/salud/`)
5. **Actualiza la documentacion**: tabla del `README.md` de la lib; si cambia
   la API publica, `docs/decisiones-tecnicas.md` (nueva decision o ampliar la
   13); si cambia `/health`, `README.md` raiz y `docs/arquitecturas.md`.
6. **Verifica globalmente**: `pnpm verify` (no basta con la lib: el error
   aparece en los consumidores). Busca usos con
   `grep -r "NombreDelTipo" apps libs`.
7. **Valida el frontend en navegador** (regla de `CLAUDE.md`/`AGENTS.md`):
   `web` consume ambas libs.

## 6. Anti-patrones

- Poner `clasificarSolicitud()` o una tabla de "palabra clave -> area" en
  `libs/dominio`. Eso es logica de triaje.
- Cambiar un DTO para que le quede comodo a una sola arquitectura.
- Duplicar un DTO dentro de una app "para no depender de la lib".
- Importar `@nestjs/*`, `@angular/*`, `rxjs` o cualquier paquete en una lib.
- Usar `string` donde existe un tipo de dominio.
- Agregar un archivo sin exportarlo en `index.ts` ni listarlo en el README.

## 7. Checklist

- [ ] El cambio cae en contratos o dominio segun el arbol; no es logica.
- [ ] Sin dependencias de framework; `readonly`; `as const` + tipo derivado.
- [ ] JSDoc en cada export, con `HU-xx` si aplica.
- [ ] Exportado en `src/index.ts`; tabla del README actualizada.
- [ ] Mappers, repositorios HTTP y etiquetas actualizados.
- [ ] `pnpm verify` pasa.
- [ ] Frontend validado en navegador.

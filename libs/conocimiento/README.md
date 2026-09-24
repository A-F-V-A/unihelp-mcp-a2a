# @unihelp/conocimiento

Base de conocimiento de UniHelp: políticas institucionales versionadas, servicios
con su estado publicado, componentes y categorías, modelados como un grafo sobre
PostgreSQL 16.

Las cuatro arquitecturas (B0-B3) y `mcp-server` consultan el mismo conocimiento.
Si cada una tuviera su propia búsqueda, una diferencia en las mediciones podría
venir del buscador y no del protocolo. Por eso esta librería es **compartida** y
**determinista**: la misma consulta sobre el mismo estado devuelve siempre el
mismo resultado en el mismo orden (HU-08), y el entorno se restablece a una
variante conocida con una huella verificable antes de cada ejecución (HU-24, HU-36).

> Estado: la consume B0 (`apps/b0-directo`). Las demás arquitecturas todavía no.

**Lo que NO contiene**: lógica de triaje (clasificar, calcular la prioridad,
decidir si proponer un ticket), que vive en cada arquitectura (decisión 8); DTOs de
red, que viven en [`@unihelp/contratos`](../contratos/README.md). El frontend no
puede importarla: arrastraría TypeORM al bundle, y el lint lo impide con el tag
`alcance:backend`.

**Modelo de datos y contenido de la semilla**: diagrama entidad-relación, DBML,
estados iniciales, las 39 políticas y la tabla de huellas esperadas en
[`docs/base-de-conocimiento.md`](../../docs/base-de-conocimiento.md).

---

## Desde cero: base, migraciones y semilla

Requiere Docker. Desde la raíz del repositorio:

```bash
pnpm conocimiento:db                # PostgreSQL 16.15 en localhost:5432 (tmpfs: siempre vacía al crearse)
pnpm conocimiento:preparar          # migrar + sembrar la variante base
```

| Comando                                                  | Qué hace                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm conocimiento:migrar`                               | Crea el esquema `conocimiento`.                                              |
| `pnpm conocimiento:sembrar`                              | Carga `todo_operativo` con corpus `estandar` en una base vacía; idempotente. |
| `pnpm conocimiento:restablecer [estadoInicial] [corpus]` | Borra y repuebla la variante pedida. Exige `UNIHELP_PERFIL=experimento`.     |
| `pnpm conocimiento:huella`                               | Huella, entorno y conteos de lo que hay en la base.                          |
| `pnpm conocimiento:huellas`                              | Huellas esperadas de las 20 variantes, sin base de datos.                    |
| `pnpm conocimiento:test-integracion`                     | Pruebas contra la base `unihelp_test`.                                       |

```bash
# PowerShell: $env:UNIHELP_PERFIL='experimento'
UNIHELP_PERFIL=experimento pnpm conocimiento:restablecer av_degradado_carga estandar
```

Para empezar otra vez desde una base vacía: `pnpm down` y repetir.

### Variables de entorno

| Variable                         | Obligatoria | Uso                                                                                         |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `CONOCIMIENTO_DATABASE_URL`      | sí (módulo) | URL de PostgreSQL. El CLI usa `postgres://unihelp:unihelp@localhost:5432/unihelp` si falta. |
| `CONOCIMIENTO_UMBRAL_RELEVANCIA` | no          | Decimal en `[0, 1)`. Por defecto `0.05`.                                                    |
| `UNIHELP_PERFIL`                 | no          | `experimento` habilita el restablecimiento; `produccion` lo prohíbe siempre.                |
| `NODE_ENV`                       | no          | `test` también habilita el restablecimiento.                                                |
| `CONOCIMIENTO_TEST_DATABASE_URL` | no          | Base de las pruebas de integración. Por defecto `.../unihelp_test`.                         |

---

## API pública

```ts
import { BuscarPoliticaUseCase, ConocimientoModule } from '@unihelp/conocimiento';

@Module({ imports: [ConocimientoModule.forRoot()] })
export class AppModule {}
```

### Módulo

```ts
class ConocimientoModule {
  static forRoot(
    opciones?: OpcionesConocimiento,
    entorno?: VariablesEntorno /* = process.env */,
  ): DynamicModule;
}

interface OpcionesConocimiento {
  readonly urlBaseDatos?: string; // gana a CONOCIMIENTO_DATABASE_URL
  readonly umbralRelevancia?: number; // gana a CONOCIMIENTO_UMBRAL_RELEVANCIA
}
type VariablesEntorno = Readonly<Record<string, string | undefined>>;
```

Abre su propia conexión y la cierra al detenerse. Lanza `ConfiguracionInvalidaError`
al arrancar si falta la URL o el umbral es inválido. `RestablecerConocimientoUseCase`
**solo se registra** si el perfil lo permite al llamar a `forRoot`.

### Casos de uso

```ts
class BuscarPoliticaUseCase {
  /** @throws ConsultaInvalidaError si el texto no tiene entre 3 y 300 caracteres. */
  ejecutar(consulta: ConsultaPoliticas): Promise<ResultadoBusquedaPoliticas>;
}

class ConsultarComponentesDeServicioUseCase {
  /** @throws ServicioNoEncontradoError */
  ejecutar(servicioCodigo: string): Promise<ComponentesDeServicio>;
}

class ConsultarPoliticasDeCategoriaUseCase {
  /** @throws CategoriaNoEncontradaError */
  ejecutar(categoriaCodigo: string): Promise<PoliticasDeCategoria>;
}

class ObtenerPoliticaUseCase {
  /** Sin version, la marcada como vigente. @throws PoliticaNoEncontradaError */
  ejecutar(codigo: string, version?: string | null): Promise<PoliticaCompleta>;
}

class ListarServiciosUseCase {
  /** Servicios ordenados por codigo en orden binario. */
  ejecutar(): Promise<readonly Servicio[]>;
}

class RestablecerConocimientoUseCase {
  /**
   * Por defecto { estadoInicial: 'todo_operativo', corpus: 'estandar' }.
   * @throws RestablecimientoNoPermitidoError fuera de UNIHELP_PERFIL=experimento / NODE_ENV=test.
   * @throws SeleccionEstadoInvalidaError si el estado inicial o el corpus no existen (no escribe nada).
   * @throws EstadoInconsistenteError si lo escrito no quedó idéntico a la semilla (se revierte).
   */
  ejecutar(seleccion?: Partial<SeleccionEstado>): Promise<ResultadoRestablecimiento>;
}

class SembrarConocimientoUseCase {
  /** @throws EstadoInconsistenteError si la base ya tiene datos distintos a la variante base. */
  ejecutar(): Promise<ResultadoSiembra>;
}

/** Huella de cada estado inicial x corpus, sin base de datos. */
function calcularHuellasEsperadas(semilla: SemillaConocimiento): readonly HuellaEsperada[];
```

### Tipos de entrada y salida

```ts
interface ConsultaPoliticas {
  readonly texto: string;
  readonly servicio?: string | null; // 'aula_virtual'
  readonly categoria?: string | null; // 'plazos'
}

type ResultadoBusquedaPoliticas =
  | {
      readonly tipo: 'encontradas';
      readonly consultaNormalizada: string;
      readonly umbral: number;
      readonly politicas: readonly PoliticaEncontrada[];
    } // 1 a 3
  | {
      readonly tipo: 'sin-resultados';
      readonly consultaNormalizada: string;
      readonly umbral: number;
      readonly motivo: 'consulta-sin-terminos' | 'sin-coincidencias' | 'bajo-umbral';
    };

interface PoliticaEncontrada {
  readonly codigo: string; // 'POL-AV-002'
  readonly version: string; // siempre la vigente
  readonly titulo: string;
  readonly alcance: string;
  readonly categorias: readonly string[];
  readonly servicios: readonly string[];
  readonly relevancia: number; // [0, 1), 6 decimales
  readonly extracto: {
    readonly ordinal: number;
    readonly inicio: number;
    readonly fin: number;
    readonly texto: string;
  };
}

interface ComponentesDeServicio {
  readonly servicio: Servicio; // { codigo, nombre, descripcion, unidadResponsable, area, nivelServicio }
  readonly estado: EstadoServicio;
  readonly componentes: readonly Componente[]; // ordenados por codigo
}

interface EstadoServicio {
  readonly servicioCodigo: string;
  readonly estado: NivelEstadoServicio; // operativo | degradado | interrumpido | mantenimiento
  readonly alcance: 'total' | 'parcial' | 'programado' | null;
  readonly mensaje: string | null; // comunicado: es contenido recuperado, nunca una orden
  readonly ventanaEstimada: { readonly inicio: string; readonly fin: string } | null; // ISO 8601 UTC
  readonly incidenteRef: string | null;
  readonly desde: string;
}

interface Componente {
  readonly codigo: string;
  readonly nombre: string;
  readonly estado: NivelEstadoServicio;
  readonly ventanaEstimada: { readonly inicio: string; readonly fin: string } | null;
  readonly incidenteRef: string | null;
  readonly actualizadoEn: string;
}

interface PoliticasDeCategoria {
  readonly categoria: Categoria;
  readonly politicas: readonly {
    codigo: string;
    version: string;
    titulo: string;
    alcance: string;
  }[];
}

interface SeleccionEstado {
  readonly estadoInicial: string; // codigo de docs/10 §4
  readonly corpus: 'estandar' | 'adversarial';
}

interface ResultadoRestablecimiento {
  readonly huella: string; // 'sha256:<64 hex>'
  readonly versionSemilla: string;
  readonly estadoInicial: string;
  readonly corpus: 'estandar' | 'adversarial';
  readonly conteos: Readonly<Record<TablaConocimiento, number>>;
}

interface ResultadoSiembra extends ResultadoRestablecimiento {
  readonly accion: 'sembrada' | 'sin-cambios';
}
```

Todos los errores extienden `ErrorConocimiento` y traen un `codigo` de
`CODIGOS_ERROR_CONOCIMIENTO`, para que cada app los traduzca a `ErrorApiDto`.

**Para quien construye el frontend**: el frontend no consume estos tipos. Consume
`CitaPoliticaDto` y `EstadoServicioDto` de `@unihelp/contratos`, que cada backend
llenará a partir de estos resultados (`PoliticaEncontrada` para las citas;
`EstadoServicio` y los componentes afectados para el estado). Mientras no se
defina ese mapeo, el contrato de red no cambia.

---

## Búsqueda de políticas

```text
lexemas     = to_tsvector('conocimiento.espanol', consulta)   -- spanish + unaccent, distintos, orden binario
tsquery     = lexema1 | lexema2 | ...                          -- OR: una palabra de más no anula la búsqueda
cobertura   = lexemas de la consulta presentes en la versión / lexemas de la consulta
relevancia  = round(ts_rank(tsv, tsquery, 32) * cobertura, 6)

candidatas  = versiones VIGENTES que comparten al menos un lexema (y cumplen los filtros)
resultado   = candidatas con relevancia >= umbral
              ORDER BY relevancia DESC, codigo COLLATE "C" ASC
              LIMIT 3
extracto    = el de mayor round(ts_rank, 6) dentro de la versión; empate -> menor ordinal
```

Las políticas adversariales no se filtran en la consulta: con corpus `estandar`
simplemente no están en la base.

Calibración del umbral `0.05` contra la semilla `2026.09.14-2`
([casos](seeds/casos-busqueda.json)): la política esperada queda primera en los 16
objetivos y ninguna consulta sin respuesta llega al umbral.

| Consulta                                                      | Corpus      | Esperada    | Relevancia | Siguiente         |
| ------------------------------------------------------------- | ----------- | ----------- | ---------- | ----------------- |
| prórroga de entrega por falla técnica comprobada              | estandar    | POL-AV-002  | 0.3798     | 0.0802            |
| prórroga de entrega por fuerza mayor personal                 | estandar    | POL-AV-003  | 0.3781     | 0.0802            |
| apertura temporal de un curso archivado                       | estandar    | POL-AV-004  | 0.3795     | 0.1203            |
| vigencia del correo institucional para egresados              | estandar    | POL-CI-002  | 0.3781     | 0.2362            |
| reactivación del correo institucional por inactividad         | estandar    | POL-CI-003  | 0.3795     | 0.1177            |
| recuperación de acceso al correo institucional                | estandar    | POL-CI-001  | 0.3810     | 0.1166            |
| límite de envío a destinatarios externos                      | estandar    | POL-CI-004  | 0.3280     | 0.1847            |
| cambio de contraseña institucional                            | estandar    | POL-AU-001  | 0.3828     | 0.1215            |
| desbloqueo de cuenta por intentos fallidos                    | estandar    | POL-AU-002  | 0.3839     | 0.2567            |
| desbloqueo de cuenta por incidente de seguridad               | estandar    | POL-AU-003  | 0.3795     | 0.1198            |
| cancelación de asignatura dentro del plazo ordinario          | estandar    | POL-MA-001  | 0.3793     | 0.0802            |
| cancelación extemporánea de asignatura                        | estandar    | POL-MA-002  | 0.3800     | 0.1964            |
| matrícula extemporánea con recargo                            | estandar    | POL-MA-004  | 0.3010     | 0.1248            |
| normas de uso responsable del aula virtual                    | adversarial | POL-AV-006  | 0.3392     | 0.0782            |
| espacio de almacenamiento del correo institucional            | adversarial | POL-CI-006  | 0.3280     | 0.1177            |
| consultar el estado de la matrícula                           | adversarial | POL-MA-006  | 0.3852     | 0.1198            |
| ¿Puedo pagar la matrícula en cuotas… con tarjeta? (T-INF-008) | estandar    | _(ninguna)_ | 0.0257     | bajo umbral       |
| ¿Cuántos libros… biblioteca digital? (T-INF-009)              | estandar    | _(ninguna)_ | 0.0012     | bajo umbral       |
| El wifi del bloque de ingeniería se cae… (T-DIA-006)          | estandar    | _(ninguna)_ | 0.0049     | bajo umbral       |
| La talanquera del parqueadero no lee mi carné (T-COM-006)     | estandar    | _(ninguna)_ | —          | sin coincidencias |

---

## Dónde podría perderse el determinismo y cómo se evita

| Punto                          | Riesgo                                                                 | Garantía                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modelo de recuperación         | Embeddings o ANN devuelven vecinos aproximados y cambian con el modelo | Solo `tsvector`/`ts_rank`. Ningún modelo de representación (HU-08).                                                                                                |
| Texto de la consulta           | `í` compuesta vs. `i` + tilde combinada                                | Normalización NFC y colapso de espacios antes de buscar.                                                                                                           |
| Tildes                         | `matricula` vs. `matrícula` dan lexemas distintos                      | Configuración `conocimiento.espanol` con `unaccent` antes de `spanish_stem`.                                                                                       |
| Empates de relevancia          | `float4` casi iguales se ordenan por ruido o por orden físico          | `round(..., 6)` en `numeric`: los empates son exactos y se desempatan por código.                                                                                  |
| Desempate por código           | `ORDER BY codigo` depende de la collation de la base                   | `COLLATE "C"` en todo `ORDER BY` de texto; en TypeScript, comparación por punto de código, nunca `localeCompare`.                                                  |
| Orden de inserción             | PostgreSQL no garantiza orden sin `ORDER BY`                           | Toda lectura tiene `ORDER BY` total; una prueba inserta políticas en orden inverso y verifica el resultado.                                                        |
| Versión citada                 | "Vigente según la fecha de hoy" cambia con el reloj                    | `vigente` es una columna explícita, única por política.                                                                                                            |
| Lecturas concurrentes          | El conteo y los resultados ven estados distintos                       | Cada búsqueda y cada recorrido corren en una transacción `REPEATABLE READ`.                                                                                        |
| Diccionarios de texto completo | Otra versión de PostgreSQL podría cambiar el stemming                  | Imagen fijada por digest (PostgreSQL 16.15).                                                                                                                       |
| Variante cargada               | Dos estados iniciales con datos casi iguales                           | La fila `entorno` (semilla, estado inicial, corpus) entra en la huella: las 20 variantes tienen huellas distintas (prueba unitaria).                               |
| Serialización para la huella   | Orden de filas, zona horaria, `DateStyle`, precisión de `Date`         | Tuplas con columnas en orden fijo, filas ordenadas por clave primaria, instantes vía `to_char(... AT TIME ZONE 'UTC')`, precisión de segundos exigida por `CHECK`. |
| Formato de la huella           | Cambiar la serialización sin darse cuenta                              | Prefijo `unihelp/conocimiento/estado-canonico/v2` dentro del texto hasheado y huella dorada en una prueba unitaria.                                                |
| Restablecimiento               | Una ejecución ve la base a medio repoblar                              | `TRUNCATE` + inserciones + relectura en una transacción `SERIALIZABLE`; si la relectura no es idéntica, se revierte.                                               |

---

## Semilla

[`seeds/conocimiento.semilla.json`](seeds/conocimiento.semilla.json), versión
`2026.09.14-2`, construida desde `docs/10-conjunto-de-tareas.md`:

- **4 servicios** con nivel de servicio y **13 componentes**, cada uno de un solo servicio.
- **10 estados iniciales** de docs/10 §4, con comunicado, ventana y referencia
  sintéticos coherentes con las tareas.
- **39 políticas y 55 versiones**: las 21 no adversariales de docs/10 con su texto
  literal, 15 distractoras nuevas, 13 versiones históricas y las 3 adversariales
  redactadas desde T-ADV-001..003 (solo en corpus `adversarial`).
- **16 políticas objetivo** (todas las que alguna tarea espera citar, más las
  parejas de distracción) con 4 distractoras cada una, y **6 consultas sin
  respuesta**, en [`seeds/casos-busqueda.json`](seeds/casos-busqueda.json).
- `notas` dentro del JSON explica qué es literal de docs/10 y qué es sintético.
- Anonimizada: la validación rechaza cualquier URL o correo fuera de los dominios
  reservados (RFC 2606).

Detalle completo y huellas esperadas en
[`docs/base-de-conocimiento.md`](../../docs/base-de-conocimiento.md).

---

## Archivos

| Archivo                                                                                                                                                                                                                                              | Contenido                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`conocimiento.module.ts`](src/conocimiento.module.ts)                                                                                                                                                                                               | `ConocimientoModule.forRoot()`.                                                                                                                                                                                                                                                                      |
| [`dominio/servicio.ts`](src/dominio/servicio.ts)                                                                                                                                                                                                     | `Servicio` y `NIVELES_SERVICIO`.                                                                                                                                                                                                                                                                     |
| [`dominio/estado-servicio.ts`](src/dominio/estado-servicio.ts)                                                                                                                                                                                       | `EstadoServicio` y `ALCANCES_AFECTACION`.                                                                                                                                                                                                                                                            |
| [`dominio/componente.ts`](src/dominio/componente.ts), [`categoria.ts`](src/dominio/categoria.ts)                                                                                                                                                     | `Componente`, `VentanaEstimada`, `Categoria`.                                                                                                                                                                                                                                                        |
| [`dominio/politica.ts`](src/dominio/politica.ts)                                                                                                                                                                                                     | `Politica`, `VersionPolitica`, `Extracto`, `ORIGENES_POLITICA`.                                                                                                                                                                                                                                      |
| [`dominio/grafo.ts`](src/dominio/grafo.ts)                                                                                                                                                                                                           | Aristas, `EstadoConocimiento`, `EntornoConocimiento`, corpus y recorridos.                                                                                                                                                                                                                           |
| [`dominio/busqueda.ts`](src/dominio/busqueda.ts)                                                                                                                                                                                                     | Consulta y resultado de la búsqueda.                                                                                                                                                                                                                                                                 |
| [`dominio/semilla.ts`](src/dominio/semilla.ts)                                                                                                                                                                                                       | Forma del archivo semilla y `SeleccionEstado`.                                                                                                                                                                                                                                                       |
| [`dominio/errores.ts`](src/dominio/errores.ts)                                                                                                                                                                                                       | `ErrorConocimiento` y sus subclases.                                                                                                                                                                                                                                                                 |
| [`dominio/puertos/conocimiento.repository.ts`](src/dominio/puertos/conocimiento.repository.ts)                                                                                                                                                       | Puerto del repositorio y sus garantías.                                                                                                                                                                                                                                                              |
| [`dominio/reglas/semilla.rules.ts`](src/dominio/reglas/semilla.rules.ts)                                                                                                                                                                             | Validación de la semilla y construcción de cada variante.                                                                                                                                                                                                                                            |
| [`dominio/reglas/estado-canonico.rules.ts`](src/dominio/reglas/estado-canonico.rules.ts)                                                                                                                                                             | Serialización canónica y orden binario.                                                                                                                                                                                                                                                              |
| [`dominio/reglas/consulta.rules.ts`](src/dominio/reglas/consulta.rules.ts)                                                                                                                                                                           | Normalización y límites de la consulta.                                                                                                                                                                                                                                                              |
| [`aplicacion/*.use-case.ts`](src/aplicacion/)                                                                                                                                                                                                        | Los nueve casos de uso. `ObtenerPolitica` y `ListarServicios` sirven al frontend y al catálogo de áreas; `ListarEstadosIniciales` lee la semilla y responde sin base; `ConsultarEntorno` dice qué variante está cargada y lee el grafo completo, así que nunca se usa dentro del camino que se mide. |
| [`aplicacion/huellas-esperadas.ts`](src/aplicacion/huellas-esperadas.ts)                                                                                                                                                                             | `calcularHuellasEsperadas`.                                                                                                                                                                                                                                                                          |
| [`aplicacion/configuracion.ts`](src/aplicacion/configuracion.ts), [`huella.ts`](src/aplicacion/huella.ts), [`tokens.ts`](src/aplicacion/tokens.ts)                                                                                                   | Entorno, umbral, perfil, huella y tokens de inyección.                                                                                                                                                                                                                                               |
| [`infraestructura/entidades/`](src/infraestructura/entidades/)                                                                                                                                                                                       | Entidades TypeORM (solo escritura).                                                                                                                                                                                                                                                                  |
| [`infraestructura/migraciones/`](src/infraestructura/migraciones/)                                                                                                                                                                                   | Migraciones versionadas.                                                                                                                                                                                                                                                                             |
| [`infraestructura/typeorm-conocimiento.repository.ts`](src/infraestructura/typeorm-conocimiento.repository.ts)                                                                                                                                       | SQL de búsqueda, recorridos, siembra y restablecimiento.                                                                                                                                                                                                                                             |
| [`infraestructura/data-source.ts`](src/infraestructura/data-source.ts), [`esquema.ts`](src/infraestructura/esquema.ts), [`cargar-semilla.ts`](src/infraestructura/cargar-semilla.ts), [`cierre-conexion.ts`](src/infraestructura/cierre-conexion.ts) | Conexión, nombres del esquema, carga de la semilla y cierre.                                                                                                                                                                                                                                         |
| [`infraestructura/cli/conocimiento.cli.ts`](src/infraestructura/cli/conocimiento.cli.ts)                                                                                                                                                             | CLI `migrar`, `sembrar`, `restablecer`, `huella`, `huellas`.                                                                                                                                                                                                                                         |
| [`infraestructura/typeorm-conocimiento.repository.int-spec.ts`](src/infraestructura/typeorm-conocimiento.repository.int-spec.ts)                                                                                                                     | Pruebas de integración, incluida la de diez repeticiones.                                                                                                                                                                                                                                            |
| [`seeds/conocimiento.semilla.json`](seeds/conocimiento.semilla.json)                                                                                                                                                                                 | Datos semilla versionados.                                                                                                                                                                                                                                                                           |
| [`seeds/casos-busqueda.json`](seeds/casos-busqueda.json)                                                                                                                                                                                             | Políticas objetivo, distractoras y consultas sin respuesta.                                                                                                                                                                                                                                          |

`dominio/` no importa NestJS, TypeORM ni `pg`, y `aplicacion/` no importa
`infraestructura/`: lo verifica [`eslint.config.mjs`](eslint.config.mjs).

---

## Por qué PostgreSQL y no un motor de grafos

Se evaluaron Neo4j y ArangoDB. Se descartaron por dos razones:

1. **Determinismo auditable.** Con SQL, el orden completo está escrito en la
   consulta (`ORDER BY relevancia DESC, codigo COLLATE "C"`) y cualquiera puede
   leerlo y reproducirlo. En un motor de grafos, el orden de los recorridos y el
   ranking de su búsqueda de texto dependen de detalles internos del motor.
2. **Menos infraestructura para replicar.** PostgreSQL ya se usará para tickets y
   auditoría. Un segundo motor sería otro servicio, otra imagen y otro formato de
   respaldo que un tercero tendría que levantar.

El grafo es pequeño (decenas de nodos) y los recorridos tienen uno o dos saltos.
Registrado en `docs/decisiones-tecnicas.md`, decisiones 16, 17 y 18.

---

Dependencias: `@unihelp/dominio`, `@nestjs/common`, `typeorm`, `pg`.
Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend`.

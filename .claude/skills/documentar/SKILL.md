---
name: documentar
description: Convenciones de documentacion de UniHelp. Usar al escribir o revisar comentarios en codigo (JSDoc), crear o actualizar un README de proyecto, agregar un documento en docs/ o registrar una decision tecnica.
---

# Documentar en UniHelp

El repositorio es un trabajo de grado que un tercero debe poder **reproducir y
entender sin preguntar**. La documentacion es parte del entregable, no un
extra.

## 1. Comentarios en codigo

### Principio

Comenta **por que** existe algo, **que garantiza** o **que prohibe**. No
repitas lo que el codigo ya dice.

```ts
// MAL: repite el codigo
/** Devuelve true si el estado es pendiente. */
export function propuestaPendiente(p: PropuestaTicket): boolean { ... }

// BIEN: explica la regla de negocio y su origen
/**
 * Una propuesta solo admite una resolucion. Confirmada o rechazada, queda
 * cerrada: una propuesta descartada no se puede volver a confirmar (HU-FE-18).
 */
export function propuestaPendiente(p: PropuestaTicket): boolean { ... }
```

### Formatos

| Formato              | Uso                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/** ... */` (JSDoc) | Sobre exports: interfaces, tipos, constantes, clases, metodos de puertos.                                  |
| `/** Una linea. */`  | Suficiente para la mayoria de exports y propiedades.                                                       |
| Bloque al inicio     | Archivos que definen un tema (`triaje.ts`, `api.contrato.ts`): proposito del archivo y lo que NO contiene. |
| `/* ... */`          | Nota de archivo que no documenta un simbolo (ver `application/di/tokens.ts`).                              |
| `// ...`             | Dentro de funciones, solo para un detalle no evidente.                                                     |

### Reglas

- Español. La convencion vigente escribe sin tildes en comentarios; no mezclar
  en un mismo archivo.
- Identificadores entre comillas invertidas: `` `ErrorBackend` ``,
  `` `USE_MOCK_BACKEND` ``. Enlaces a tipos con `{@link TicketDto}`.
- Trazabilidad entre parentesis al final: `(HU-13)`, `(HU-13 a HU-17)`,
  `(HU-FE-19)`, `(decision 14)`.
- Mayusculas para enfatizar una garantia critica: `UNICO punto`, `NUNCA`.
- En DTOs: formato y ejemplo cuando no es obvio: `/** ISO 8601. */`,
  `/** Ej.: `UH-2026-001208`. */`.
- En puertos: que hace cada metodo y que **no** hace
  (`No crea ningun ticket.`).
- Todo export de `libs/` lleva JSDoc. En apps, al menos puertos, casos de uso,
  reglas y componentes (una linea con la HU que implementan).
- Sin comentarios en codigo trivial (mappers campo a campo, getters).
- Sin codigo comentado, `TODO` sin contexto ni historial de cambios en
  comentarios (eso es git). Un `TODO` valido dice que falta y por que:
  `// TODO(B1): reemplazar por el cliente MCP cuando exista mcp-server real.`
- Si cambias el comportamiento, **actualiza el comentario en el mismo cambio**.
  Un comentario falso es peor que ninguno.

## 2. README por proyecto

Cada proyecto de `libs/` tiene `README.md`; las apps lo tendran cuando su
contenido deje de ser el esqueleto. Plantilla:

````md
# @unihelp/<nombre> | <nombre-app>

Una frase: que es.

Un parrafo: por que existe en el experimento y que garantiza.

| Archivo                | Contenido |
| ---------------------- | --------- |
| [`x.ts`](src/lib/x.ts) | ...       |

**Lo que NO contiene** (y donde va en su lugar).

```ts
import { ... } from '@unihelp/<nombre>';
```

Dependencias permitidas / tags Nx.
````

Reglas:

- La tabla de archivos se mantiene al dia: archivo nuevo = fila nueva.
- Enlaces relativos a archivos reales.
- Nada de instrucciones de arranque duplicadas del `README.md` raiz: enlazalas.

## 3. README raiz

Es la puerta de entrada para un evaluador. Se actualiza cuando cambia: como
levantar algo, puertos, estructura de carpetas, estado del proyecto (el bloque
"Estado actual") o convenciones generales.

## 4. Carpeta `docs/`

Indice y organizacion en `docs/README.md`. Hay dos tipos de documento:

| Tipo                   | Archivos                                             | Como se cambia                                                                                                                  |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Anexo (especificacion) | `00-` a `10-*.md`, `tasks/`                          | 08, 09, 10 y `tasks/` son **generados** ("no editar a mano"): se cambia su fuente. 00-07 se editan solo con acuerdo del equipo. |
| Implementacion         | `arquitecturas.md`, `decisiones-tecnicas.md`, nuevos | A mano, en el mismo cambio que el codigo.                                                                                       |

Reglas:

- Antes de crear o sobrescribir un archivo en `docs/`, **mira que hay**
  (incluidos archivos sin versionar): la carpeta recibe documentos de fuera
  del repositorio.
- Nombres de archivo en kebab-case, sin ñ ni tildes (`diseno-experimento.md`).
  El prefijo numerico `NN-` queda reservado para el anexo.
- Un documento por tema; si pasa de ~400 lineas, dividir en subcarpeta.
- Si un documento de implementacion contradice al anexo, se anota en la tabla
  "Discrepancias conocidas" de `AGENTS.md`.
- Primer parrafo: que responde el documento y a quien le sirve.
- Diagramas en bloques `text` (ASCII) o `mermaid`; nada de imagenes binarias
  sin fuente.
- Todo documento nuevo se enlaza desde `docs/README.md`.
- Documentos que describen algo aun no implementado lo dicen al inicio:
  `> Estado: propuesta, no implementado.`

## 5. Decisiones tecnicas

> El anexo (`docs/07`, seccion 5) preve ADRs separados en `docs/adr/` y un
> `deviations.md`; hoy el repositorio usa un unico registro. Mientras el equipo
> no decida, se sigue usando `docs/decisiones-tecnicas.md`.

`docs/decisiones-tecnicas.md` es un registro numerado y **solo crece**. Se
agrega una entrada cuando se toma una decision que un tercero podria cuestionar
("¿por que no hicieron X?"): elegir una libreria, una estructura, desviarse de
lo estandar, aceptar una limitacion.

```md
## N. Titulo corto en forma de afirmacion

Contexto: que problema o restriccion habia.

Decision: que se hizo, con rutas a los archivos concretos.

Por que: alternativas consideradas y razon de descartarlas.

Consecuencias: que implica, que queda pendiente, cuando se podria revertir.
```

- No se reescriben decisiones antiguas: si una cambia, se agrega una nueva que
  la reemplaza y se anota en la vieja `> Reemplazada por la decision M.`
- En codigo se cita como `(decision N)`.

## 6. Que actualizar segun el cambio

| Cambiaste...                          | Actualiza                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Un archivo en `libs/`                 | JSDoc + tabla del README de la lib                                           |
| Una ruta o DTO                        | JSDoc en `RUTAS_API` + `docs/decisiones-tecnicas.md` si es API publica nueva |
| Puertos, servicios o profiles Docker  | `docs/arquitecturas.md` + `README.md` raiz                                   |
| Una forma de trabajar o una regla     | `AGENTS.md` (y la skill correspondiente)                                     |
| Algo que parecia raro y es deliberado | Nueva decision en `docs/decisiones-tecnicas.md`                              |
| Un escenario simulado nuevo           | Tabla "Frases que activan..." del `README.md` raiz                           |

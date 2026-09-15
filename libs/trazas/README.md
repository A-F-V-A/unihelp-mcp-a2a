# @unihelp/trazas

Validacion y persistencia de trazas de ejecucion para los backends NestJS.

Toda traza se valida con AJV contra `experiment/schemas/traza.schema.json` **antes**
de persistirse. Una traza valida se agrega a `trazas.jsonl`; una invalida se aparta
en `cuarentena/` con status `esquema_invalido` y nunca entra al conjunto oficial.
La libreria **valida, no calcula**: ninguna metrica se calcula en TypeScript
(decision 19). Las comprobaciones aritmeticas de instrumentacion (residuo de
orquestacion) y todo el calculo viven en [`experiment/analisis/`](../../experiment/analisis).

| Archivo                                                                      | Contenido                                                              |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`validador-trazas.ts`](src/lib/validador-trazas.ts)                         | `ValidadorTrazas`: AJV estricto, todos los errores con su ruta.        |
| [`persistidor-trazas.ts`](src/lib/persistidor-trazas.ts)                     | `PersistidorTrazas`: append con fsync o sobre de cuarentena.           |
| [`trazas.module.ts`](src/lib/trazas.module.ts)                               | `TrazasModule.registrar({ directorioCorrida })` para NestJS.           |
| [`traza.generado.ts`](src/lib/traza.generado.ts)                             | Tipo `TrazaEjecucion`, **generado** desde el esquema.                  |
| [`esquema-traza.generado.ts`](src/lib/esquema-traza.generado.ts)             | `ESQUEMA_TRAZA` embebido, **generado** desde el esquema.               |
| [`casos-compartidos.ts`](src/lib/casos-compartidos.ts)                       | Solo pruebas: casos de validacion que Python y AJV deben juzgar igual. |
| [`generacion/generar-desde-esquema.ts`](generacion/generar-desde-esquema.ts) | Generador de los dos archivos `*.generado.ts` (y modo `--verificar`).  |

**El esquema manda.** Si cambia `traza.schema.json`, en el mismo commit se sube
`version_esquema` y se ejecuta `pnpm nx run trazas:generar`. La prueba
`sincronia-esquema.spec.ts` falla si los archivos generados no coinciden.

```ts
import { TrazasModule, PersistidorTrazas, type TrazaEjecucion } from '@unihelp/trazas';

@Module({ imports: [TrazasModule.registrar({ directorioCorrida: 'runs/2026-10-14-oficial' })] })
export class EjecucionModule {}

const resultado = persistidor.persistir(candidata);
if (resultado.estado === 'esquema_invalido') {
  // la ejecucion queda marcada; la traza esta en resultado.archivoCuarentena
}
```

**Lo que NO contiene:** logica de triaje, calculo de metricas, lectura de trazas para
analisis. Tampoco es para el frontend: depende de `node:fs`.

Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend` (el frontend no la puede
importar). Dependencias de runtime:
`ajv`, `ajv-formats` y `@nestjs/common` (solo para `TrazasModule`).

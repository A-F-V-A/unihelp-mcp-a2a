# consola-experimento

Proceso local que **lanza el ejecutor y el cuaderno de análisis desde el panel
web** (`http://localhost:4200/experimento`) y transmite su progreso línea a
línea (decisión 39). Es la pieza que permite elegir la arquitectura y las tareas
en el panel, correr y ver el resultado sin abrir una terminal.

> **No calcula ninguna métrica ni modifica trazas o resultados ya escritos**
> (RM-02). Lo único que hace es arrancar, uno a la vez (RM-04), los mismos
> comandos del [`README` de `experiment/`](../../experiment/README.md):
>
> - `uv run python -u -m ejecutor correr --arquitecturas B0 --tareas T-COM-* ...`
> - `uv run papermill analisis.ipynb salidas/analisis.ejecutado.ipynb --cwd . -p directorio_corrida corridas/<nombre>`
> - `uv run python -u -m ejecutor indice` (tras cada corrida, para el catálogo del panel)
>
> Una corrida lanzada desde aquí es idéntica a una lanzada en la terminal:
> misma `corrida.yaml`, mismo `config_hash`, mismos artefactos.

## Correr

Requiere [uv](https://docs.astral.sh/uv/) en el `PATH` y, para una corrida, la
arquitectura levantada con `UNIHELP_PERFIL=experimento` (igual que el ejecutor).

```bash
pnpm dev:consola          # consola en http://localhost:3030 (solo 127.0.0.1)
pnpm dev:web              # panel en http://localhost:4200/experimento
```

El frontend la busca en `consolaUrl` de `apps/web/public/config.json`
(`http://localhost:3030` por defecto) o en `?consola=http://...`. Si no responde,
el panel sigue funcionando en solo lectura y muestra el comando para la terminal.

## Rutas

Contrato en [`libs/contratos/src/lib/consola-experimento.contrato.ts`](../../libs/contratos/src/lib/consola-experimento.contrato.ts).
Viven fuera de `/api` (decisiones 6 y 32).

| Ruta                                  | Qué hace                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `GET /health`                         | Identidad del servicio, como en todas las apps                             |
| `GET /consola/estado`                 | Trabajo en marcha (o el último) y con qué `uv` y directorio trabaja        |
| `POST /consola/corridas`              | Lanza `ejecutor correr` con las opciones validadas; 409 si ya hay uno      |
| `POST /consola/analisis`              | Corre el cuaderno sobre una corrida existente; 409 si ya hay uno           |
| `GET /consola/trabajos/:id`           | El trabajo con toda su salida hasta ahora                                  |
| `GET /consola/trabajos/:id/eventos`   | SSE: una línea por evento y un evento `fin` al terminar                    |
| `POST /consola/trabajos/:id/cancelar` | Termina el árbol de procesos (`taskkill /T` en Windows, `SIGTERM` en Unix) |
| `GET /revision/muestra`               | Muestra ciega de la revisión humana del juez (`experiment/juez/revision-humana/muestra.json`) |
| `GET /revision/revisores/:rol`        | Progreso de A o B: **solo** sus propias calificaciones (la última por ítem) |
| `POST /revision/calificaciones`       | Guarda una calificación; 409 si el rol es de otra persona, 400 si el veredicto no sale de la rúbrica |
| `GET /revision/adjudicacion`          | Desacuerdos entre A y B; vacío (`disponible: false`) hasta que ambos califican toda la muestra |
| `POST /revision/adjudicaciones`       | Resuelve un desacuerdo con veredicto y motivo obligatorio               |
| `GET /datos-experimento/*`            | Solo lectura: `docs/tasks`, `experiment/ejecutor/corrida.yaml`, `experiment/salidas`, `experiment/corridas`. En desarrollo el servidor de Angular reenvía aquí (`apps/web/proxy.conf.json`) |

## Revisión humana del juez (M7.4, M7.5)

Contrato en [`libs/contratos/src/lib/revision-humana.contrato.ts`](../../libs/contratos/src/lib/revision-humana.contrato.ts);
la usa el panel en `/experimento/revision`. Trabaja sobre
`<UNIHELP_DIRECTORIO_EXPERIMENTO>/juez/revision-humana/` (`experiment/` por defecto):

| Archivo                   | Quién lo escribe                                                 |
| ------------------------- | ---------------------------------------------------------------- |
| `muestra.json`            | `juez/preparar_muestra_humana.py` (160 ítems ciegos). La consola solo lo lee |
| `clave-muestra.json`      | El mismo script. **La consola nunca lo lee ni lo sirve**; no se versiona |
| `calificaciones-A.jsonl`, `calificaciones-B.jsonl` | La consola, solo agregar; la última línea de cada ítem manda |
| `adjudicaciones.jsonl`    | La consola, solo agregar; la última línea de cada ítem manda     |

- Un rol pertenece a quien lo tomó primero (el nombre se compara sin mayúsculas
  ni espacios de los extremos) y una persona no puede tomar los dos.
- El veredicto no se elige: debe ser `aprobado` exactamente cuando todos los
  puntos clave están cubiertos y ninguna prohibición violada.
- Cuando A y B terminaron y todo desacuerdo está adjudicado,
  `juez/incorporar_humana.py` escribe `calificacion-humana.jsonl` en cada corrida.

## Seguridad

- Escucha solo en `127.0.0.1`: lanza procesos del sistema y no debe verse desde la red.
- Todo argumento se valida contra una forma cerrada (`argumentos.ts`) y el
  proceso se lanza sin intérprete de comandos: nada que escriba el panel puede
  convertirse en otro comando.
- No hay imagen Docker: es una herramienta de desarrollo. La corrida oficial
  sigue exigiendo congelar la configuración (RM-13); lanzarla desde el panel no
  cambia eso.

## Archivos

| Archivo                            | Contenido                                                              |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `src/app/consola/argumentos.ts`    | Validación y traducción de los DTOs a la lista de argumentos de `uv`   |
| `src/app/consola/trabajos.service.ts` | Un trabajo a la vez: lanza, captura la salida, cancela y reescribe el índice |
| `src/app/consola/consola.controller.ts` | Las rutas de `RUTAS_CONSOLA`, incluido el flujo SSE                 |
| `src/app/revision/revision.service.ts` | Muestra, calificaciones y adjudicación de la revisión humana, con sus validaciones |
| `src/app/revision/revision.controller.ts` | Las rutas de `RUTAS_REVISION`                                     |
| `src/app/salud/`                   | `/health`, idéntico al resto de apps salvo `identidad.ts`              |
| `src/app/http/`                    | `ErrorApi` y su filtro, con el `ErrorApiDto` del contrato              |

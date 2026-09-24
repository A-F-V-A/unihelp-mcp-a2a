# experiment/visor — las tareas en vivo, en el navegador

Reproduce las 40 tareas de `docs/tasks/` sobre el frontend real con Playwright:
una persona simulada teclea cada turno, espera la respuesta del agente y, en un
panel lateral, se ve lo que el backend midio de esa ejecucion: tokens por turno,
desglose de la latencia, herramientas invocadas, tickets y el veredicto de la
compuerta automatica. Sirve para **ver** como se comporta una arquitectura y
cuanto consume, no para producir cifras del estudio.

**No calcula ninguna metrica** (RM-02, decision 37). Lo que muestra son lecturas
crudas de `GET /experimento/trazas/:traceId`; la unica aritmetica es la resta
entre dos lecturas para atribuir a cada turno lo que consumio. El veredicto
"supera / no supera" lo da `experiment/ejecutor` en Python, con el mismo codigo
que la corrida oficial.

## Correr

Requiere la arquitectura levantada con `UNIHELP_PERFIL=experimento` (para
restablecer el entorno y leer la traza), el frontend en marcha, Google Chrome y
[uv](https://docs.astral.sh/uv/) (para el veredicto de la compuerta).

```bash
pnpm conocimiento:db && pnpm conocimiento:migrar && pnpm tickets:migrar
pnpm exec nx build b0-directo && node dist/apps/b0-directo/main.js   # B0 en :3000
pnpm dev:web                                                          # frontend en :4200
# Para B1: pnpm dev:b1 (mcp-server :3010 + b1 :3001) y
# VISOR_ARQUITECTURA=B1 VISOR_BACKEND=http://localhost:3001 pnpm visor

pnpm visor                                  # las 40 tareas, con el navegador visible
pnpm visor -- --grep T-COM-001              # una tarea
pnpm visor -- --grep @compuesta             # una categoria (etiquetas @informativa, @diagnostico, @compuesta, @adversarial)
VISOR_TAREAS=T-ADV-* VISOR_CONFIRMACION=boton pnpm visor
pnpm visor:ui                               # modo UI de Playwright: elegir tareas y verlas correr
pnpm visor:reporte                          # reporte HTML de la ultima corrida
```

Cada tarea gasta tokens del proveedor configurado en el backend: una corrida
completa cuesta lo mismo que `pnpm ejecutor:correr`.

## Que se ve

| En el navegador              | En el panel lateral                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| La persona teclea el turno   | Tarea, categoria, estado inicial y si la huella del entorno coincidio                      |
| Aparece la respuesta         | Texto de cada turno, tiempo de respuesta y tokens que consumio (barras)                    |
| Tarjetas de politicas/estado | Consumo acumulado, latencia por componente (modelo, herramienta, transporte, orquestacion) |
| Propuesta y ticket           | Herramientas invocadas en orden, tickets creados, lo que la tarea espera                   |
| Fin de la tarea              | Veredicto de la compuerta automatica (Python) con sus motivos                              |

El reporte HTML de Playwright guarda por tarea la observacion completa
(`observacion.json`), la captura final y, si se pide, video y traza de
Playwright. Las anotaciones `tokens` y `compuerta` resumen cada prueba.

## Configuracion

Todo esta en [`visor.config.yaml`](visor.config.yaml), comentado campo por
campo: arquitectura y URLs, tareas y repeticiones, ritmo de tecleo y errores de
la persona, pausas de lectura, como responde al turno de confirmacion (`texto`,
igual que el ejecutor, o `boton`), restablecimiento del entorno, medicion,
compuerta, tamano del navegador y del panel, video y trazas.

Cualquier valor se pisa con una variable `VISOR_*` (la lista esta en
`ANULACIONES_ENTORNO` de [`src/configuracion.ts`](src/configuracion.ts)):
`VISOR_TAREAS`, `VISOR_REPETICIONES`, `VISOR_CONFIRMACION`, `VISOR_TECLEO_MS`,
`VISOR_RESTABLECER`, `VISOR_MEDICION`, `VISOR_COMPUERTA`,
`VISOR_FALLAR_SI_REPRUEBA`, `VISOR_VISIBLE`, `VISOR_CAMARA_LENTA_MS`,
`VISOR_PANEL`, `VISOR_VIDEO`, `VISOR_NOMBRE`, `VISOR_CONFIG`.

## Que hace fallar una prueba

- El backend no responde, responde 503 o informa otra arquitectura.
- La huella del estado inicial no es la esperada (`huellas-variantes.json`).
- Un turno no obtiene respuesta HTTP, o el backend responde un error.
- El agente se corta: `timeout`, `limite_herramientas` o `error_agente`.

El veredicto de la compuerta **no** hace fallar la prueba, salvo con
`medicion.fallar_si_reprueba_compuerta: true`: que una tarea no supere la
compuerta es un dato del experimento, no un defecto del visor.

## Salidas y como llevarlas al analisis

Cada corrida escribe en `salidas/<nombre>/` (no se versiona):

| Archivo               | Contenido                                                        |
| --------------------- | ---------------------------------------------------------------- |
| `observaciones.jsonl` | Una linea por ejecucion: turnos, huella, traza parcial y errores |
| `reporte/`            | Reporte HTML de Playwright (`pnpm visor:reporte`)                |
| `artefactos/`         | Capturas, videos y trazas de Playwright                          |

Para convertir una corrida del visor en un directorio de corrida del ejecutor
(trazas validadas, cuarentena, puntuaciones y manifiesto con `origen: visor`):

```bash
cd experiment && uv run python -m ejecutor importar-visor visor/salidas/<nombre>/observaciones.jsonl --nombre <corrida>
```

Es el mismo armado y la misma compuerta que `correr`, pero **no es una corrida
del ejecutor**: los turnos los teclea una persona simulada en el navegador y el
orden no sigue la matriz aleatorizada de `corrida.yaml`.

## Archivos

| Archivo                                            | Contenido                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| [`visor.config.yaml`](visor.config.yaml)           | Configuracion, comentada                                              |
| [`playwright.config.ts`](playwright.config.ts)     | Un worker, sin reintentos, Chrome del sistema, reporte por corrida    |
| [`pruebas/tareas.spec.ts`](pruebas/tareas.spec.ts) | Genera una prueba por (tarea, repeticion) y recorre la conversacion   |
| [`src/configuracion.ts`](src/configuracion.ts)     | Lectura y validacion del YAML y de las variables `VISOR_*`            |
| [`src/tareas.ts`](src/tareas.ts)                   | Lee `docs/tasks` con las reglas de `ejecutor/tareas.py`               |
| [`src/persona.ts`](src/persona.ts)                 | Tecleo con ritmo, errores corregidos y pausas de lectura, con semilla |
| [`src/backend.ts`](src/backend.ts)                 | Salud, restablecer y traza parcial, con las rutas de `libs/contratos` |
| [`src/panel.ts`](src/panel.ts)                     | Panel lateral inyectado en la pagina (shadow DOM)                     |
| [`src/observaciones.ts`](src/observaciones.ts)     | Escribe `observaciones.jsonl` y pide el veredicto a Python            |
| [`src/abrir-reporte.cjs`](src/abrir-reporte.cjs)   | Abre el reporte HTML de la ultima corrida                             |

## Limites que conviene saber

- Con `persona.confirmacion: boton` el ticket se crea por la ruta del frontend
  (`POST .../confirmacion`), no por `confirmar_propuesta` del agente: la
  compuerta lo marcara como herramienta obligatoria faltante. Sirve para ver el
  camino de la interfaz, no para comparar con el ejecutor.
- Con `entorno.enviar_trace_id: false` el backend usa el modelo elegido en la
  pantalla de configuracion y el visor lee la traza por `conv-<conversacionId>`,
  que es una convencion de B0.
- Sin `UNIHELP_PERFIL=experimento` no hay restablecimiento ni medicion: se ve la
  conversacion y nada mas.
- El panel pisa el ancho de `.disposicion` del frontend para no tapar el chat; si
  ese selector cambia, el panel se superpone pero sigue funcionando.

# experiment/

Carpeta reservada para el arnes experimental. **Esta vacia a proposito**: la
tarea de inicializacion del monorepo no incluye el experimento.

| Carpeta     | Contenido previsto                                                        |
| ----------- | ------------------------------------------------------------------------- |
| `ejecutor/` | Corredor que lanza el mismo conjunto de casos contra B0, B1, B2 y B3.     |
| `trazas/`   | Trazas crudas de cada corrida (entrada, salida, latencia, pasos, tokens). |
| `juez/`     | Evaluacion automatica de las respuestas y consolidacion de metricas.      |

Las salidas de las corridas (`experiment/trazas/`, `experiment/resultados/`) no
se versionan: son artefactos, no fuente. Ver `.gitignore`.

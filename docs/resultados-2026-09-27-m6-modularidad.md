# Resultados M6: agregar una sexta herramienta con agentes de IA

27 de septiembre de 2026. Mide cuanto cuesta agregar una capacidad nueva en cada
arquitectura (H1: integrar por MCP facilita agregar capacidades). Protocolo en las
decisiones 58 y 60; datos crudos y evidencia en `experiment/m6/`.

## 1. Configuracion

| Aspecto | Valor |
| --- | --- |
| Herramienta | `consultar_disponibilidad_soporte(sede, fecha)`: sedes, horarios, festivos y cierres sinteticos, de solo lectura |
| Quien implementa | Un subagente nuevo de Claude Code por arquitectura, sin ver las otras ramas |
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`), ventana de 1 M de tokens, esfuerzo por defecto |
| Commit base | Etiqueta `m6-base` (1afafb7); ramas `m6/b0` a `m6/b3` |
| Orden | Sorteado con semilla 20261016: B0, B3, B2, B1 |
| Modelo de UniHelp en las pruebas | Ollama, Qwen2.5 7B (`unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k`), sin API de pago |
| Calculo | Cuaderno de analisis, registro 1.3.0 (RM-02) |

Cada implementador recibio la especificacion, nueve casos de aceptacion y las
reglas del repositorio. El noveno caso es de punta a punta: ante "¿Hay soporte
presencial en la sede norte el lunes 12 de octubre de 2026?", el agente debe
llamar a la herramienta y responder que no, por festivo, sin inventar horarios.
Los cuatro lo pasaron con Ollama en el primer intento.

## 2. Resultados

| Metrica | B0 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- |
| M6.1 Archivos modificados (sin pruebas ni generados) | 14 | 12 | 18 | 22 |
| Archivos con pruebas | 17 | 16 | 21 | 26 |
| M6.2 Lineas netas (sin pruebas) | 356 | 343 | 494 | 473 |
| Lineas de prueba nuevas | 232 | 390 | 329 | 474 |
| M6.3 Servicios que hubo que reiniciar | 1 | 2 | 1 | 2 |
| M6.4 Minutos hasta la suite en verde | 10,6 | 8,4 | 11,7 | 11,7 |
| M6.5 Regresion sin tocar pruebas | 1 | 1 | 1 | 1 |

El umbral de M6.5 (1 en las cuatro) se cumple: ninguna rama edito ni borro una
prueba existente, y la suite pasa. El de M6.3 (1 en B1 y B3) no se cumple.

### Que reinicio cada arquitectura

| Arq. | Servicios con binario cambiado | Minimo que hubo que reiniciar |
| --- | --- | --- |
| B0 | `b0-directo` | `b0-directo` |
| B1 | `mcp-server`, `b1-mcp-agente` | `mcp-server` y `b1-mcp-agente` |
| B2 | `b2-multiagente-local` (`mcp-server` no cambio) | `b2-multiagente-local` |
| B3 | los cuatro servicios | `mcp-server` y `b3-a2a-orquestador` |

## 3. El proceso de IA

| Arq. | Planificacion | Lectura | Implementacion | Pruebas | Tokens | Llamadas a herramientas | Iteraciones de prueba | Archivos leidos | Lineas leidas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 | 1,4 | 0,6 | 2,6 | 5,9 | 172 214 | 52 | 5 | 35 | 6 102 |
| B1 | 0,5 | 1,4 | 3,3 | 3,3 | 174 017 | 48 | 2 | 36 | 4 303 |
| B2 | 0,5 | 2,2 | 4,3 | 4,7 | 228 104 | 85 | 7 | 55 | 7 740 |
| B3 | 0,5 | 1,8 | 4,7 | 4,7 | 210 878 | 68 | 6 | 40 | 4 544 |

Las fases estan en minutos. Los tokens y las llamadas los reporta la herramienta
Agent de Claude Code. Las lineas leidas se miden sobre `m6-base`, contando
completos los archivos que el agente dijo leer en fragmento. La planificacion de
B0 incluye unos segundos de arranque del subagente que las demas tambien tienen.
La preparacion comun (worktrees, dependencias, bases de datos) duro 3,5 minutos y
no se imputa a ninguna arquitectura.

### Como la resolvio cada uno

- **B0**: contrato en `libs/herramientas`, logica en `libs/capacidades` y registro
  aditivo en el modulo de B0. Agrego una seccion al prompt de B0: sin ella, la
  regla de alcance del prompt base impedia llamar la herramienta.
- **B1**: registro aditivo en `mcp-server` al arrancar; B1 la descubre por
  `tools/list` sin cambiar su codigo propio. La guia de uso va en la descripcion
  de la herramienta, no en el prompt. Una instantanea nueva, aparte de la de las
  cinco herramientas (RM-12).
- **B2**: la herramienta vive dentro del proceso de B2 y la llama el orquestador;
  agrego una extension opcional en `libs/multiagente-nucleo` y una seccion al
  prompt del orquestador.
- **B3**: la publica `mcp-server` solo para el rol orquestador y el orquestador de
  B3 la activa con una opcion; tambien agrega una seccion a su prompt.

Las cuatro soluciones cambian el prompt o las herramientas que ve el modelo en su
propia rama; por eso las ramas no se integran a `main` (decision 58).

## 4. Por que B1 necesito dos reinicios

El cliente MCP de la base (`libs/capacidades-mcp`) pide `tools/list` la primera
vez que el nucleo necesita las herramientas y guarda la lista. La olvida solo si
el servidor le avisa `tools/list_changed` o si su sesion se cierra.

- Al reiniciar `mcp-server`, el servidor nuevo no conoce la sesion vieja y no le
  avisa nada. B1 sigue ofreciendo al modelo la lista de cinco herramientas.
- En la siguiente llamada a una herramienta, `mcp-server` responde "La sesion MCP
  no existe" y B1 devuelve un error 503. El cliente no reconecta: la conversacion
  siguiente sigue sin ver la sexta herramienta.
- Con B1 recien levantado, sin conversaciones previas, reiniciar solo `mcp-server`
  si bastaba: B1 pidio la lista por primera vez al servidor nuevo.

Evidencia: `experiment/m6/evidencias/m63-b1/` (prueba de subconjuntos),
`m63-b1-diagnostico/` (sistema en uso) y `m63-b1-diagnostico-sin-conversacion-previa/`.
Cada carpeta guarda la respuesta, la traza (`tool_calls`) y los registros de los
servicios, incluida la linea "Herramientas descubiertas por tools/list".

La ficha esperaba un solo reinicio "por la notificacion de cambio de lista". Esa
notificacion solo sirve si la herramienta se agrega a un `mcp-server` que sigue
vivo; ningun implementador lo hizo asi, y la base no ofrece una forma de agregar
herramientas sin reiniciar el servidor.

## 5. Veredicto sobre H1

**No sostiene H1 en su criterio central.** B1 exigio mas reinicios que B0 (2
frente a 1), aunque toco menos archivos (12 frente a 14), menos lineas (343 frente
a 356) y llego antes a verde (8,4 frente a 10,6 minutos), con M6.5 = 1 en ambas.
Entre las multiagente, B3 (A2A) exigio mas reinicios, mas archivos y el mismo
tiempo que B2 (en proceso).

Es un veredicto descriptivo: hay una implementacion por arquitectura y no hay
inferencia.

- Si el responsable decide que el reinicio de B1 por la lista guardada no cuenta
  (pendiente, decision 60), M6.3 de B1 seria 1 y el veredicto cambiaria a
  "sostiene H1": B1 igualaria a B0 en reinicios con menos cambios y menos tiempo.
- El resultado depende de como cada agente decidio integrar la herramienta: otro
  agente, u otra sesion del mismo modelo, podria elegir otra forma.

## 6. Amenazas y desviaciones

- n = 1 por arquitectura; la variabilidad del agente de IA entre sesiones no esta
  medida.
- Aprendizaje entre implementaciones: cada subagente parte de cero, pero el
  conductor es el mismo. El orden se sorteo y se declara.
- La logica de las herramientas es compartida por diseño (decisiones 41 y 44): los
  cuatro agentes la pusieron en las mismas librerias, y eso favorece por igual a
  todas.
- No hubo sobre sellado (decision 58): la proteccion es que ningun codigo de la
  herramienta existia antes de lanzar a cada agente.
- `analisis:lint` falla en la base y en las cuatro ramas por el mismo motivo
  (`experiment/.venv`, 190 165 problemas identicos); se excluye de M6.5 como fallo
  preexistente, con evidencia.
- M6.3 se verifico con el modelo local: una prueba negativa se repitio dos veces
  para no confundir el azar del modelo con la falta de la herramienta.
- La ficha pide video del caso MCP; en su lugar quedan registros y trazas.

## 7. Datos y reproduccion

| Archivo en `experiment/m6/` | Que es |
| --- | --- |
| `bitacora.jsonl` | Marcas del cronometro (reloj monotono) de todas las fases |
| `uso-agentes.jsonl` | Tokens, llamadas y duracion de cada subagente |
| `archivos-leidos.json` | Lo que cada agente dijo leer |
| `repositorio.json`, `verificacion-manual.json`, `integracion-continua.json` | Insumos del cuaderno (M6.1 a M6.5) |
| `servicios-reiniciados.json`, `fallos-preexistentes.json` | Resultado de M6.3 y fallos de la base |
| `resultados-m6.json` | Cifras del cuaderno mas el proceso de IA |
| `evidencias/` | Resumenes de `pnpm verify` y conversaciones de M6.3 |
| `cronometro.py`, `recolectar.py`, `verificar_m63.py`, `diagnostico_b1_sesion.py`, `consolidar.py` | Scripts |

Las ramas `m6/b0` a `m6/b3` y la etiqueta `m6-base` estan en el remoto.

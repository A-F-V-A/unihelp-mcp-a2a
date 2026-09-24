# @unihelp/contratos

DTOs y esquemas tipados que comparten las apps de backend y el frontend.

Es el punto donde se fija **la misma interfaz para las cuatro arquitecturas**:
si B0, B1, B2 y B3 responden el mismo contrato, las diferencias que mida el
experimento vienen de la arquitectura y no de haber reimplementado el problema.

Contiene:

| Archivo                                                                      | Contrato                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`salud.contrato.ts`](src/lib/salud.contrato.ts)                             | `GET /health`                                                                                                                                                                                   |
| [`api.contrato.ts`](src/lib/api.contrato.ts)                                 | `RUTAS_API` y el cuerpo de error `ErrorApiDto`                                                                                                                                                  |
| [`conversacion.contrato.ts`](src/lib/conversacion.contrato.ts)               | envio de mensajes, historial, clasificacion y bloques                                                                                                                                           |
| [`ticket.contrato.ts`](src/lib/ticket.contrato.ts)                           | propuesta, confirmacion explicita, rechazo y ticket                                                                                                                                             |
| [`modelo-ia.contrato.ts`](src/lib/modelo-ia.contrato.ts)                     | catalogo de proveedores y modelo elegido (decision 27)                                                                                                                                          |
| [`politica.contrato.ts`](src/lib/politica.contrato.ts)                       | citas y politica completa                                                                                                                                                                       |
| [`servicio.contrato.ts`](src/lib/servicio.contrato.ts)                       | estado de servicio y ventana estimada                                                                                                                                                           |
| [`simulacion.contrato.ts`](src/lib/simulacion.contrato.ts)                   | `RUTAS_SIMULACION`: los sistemas universitarios emulados y su estado, con el vocabulario de `estado_inicial.servicios` de las tareas. Fuera de `/api` (decision 33)                             |
| [`consola-experimento.contrato.ts`](src/lib/consola-experimento.contrato.ts) | `RUTAS_CONSOLA`: lanzar el ejecutor o el cuaderno desde el panel, seguir su salida por SSE y cancelar. Las atiende `apps/consola-experimento`, fuera de `/api` (decision 39)                    |
| [`experimento.contrato.ts`](src/lib/experimento.contrato.ts)                 | `RUTAS_EXPERIMENTO`: restablecer el entorno y entregar la traza de una ejecucion. Las consume el ejecutor, NO el frontend, y viven fuera de `/api` (decision 32)                                |
| [`mcp.contrato.ts`](src/lib/mcp.contrato.ts)                                 | `RUTA_MCP`, `CABECERA_TRACE_ID` y las claves `_meta` que `mcp-server` y los agentes MCP (B1, B3) leen igual: contexto, duracion del servidor, resultado sin sanear y error tipado (decision 42) |

Los contratos de triaje se fijaron **antes** de existir el backend: el frontend
ya funciona contra ellos con datos simulados, y cada arquitectura debe
implementarlos tal cual para que ese mismo frontend funcione contra ella.

```ts
import { RUTAS_API, type RespuestaMensajeDto } from '@unihelp/contratos';
```

No depende de NestJS ni de Angular: solo tipos, para poder usarse desde ambos
lados.

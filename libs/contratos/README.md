# @unihelp/contratos

DTOs y esquemas tipados que comparten las apps de backend y el frontend.

Es el punto donde se fija **la misma interfaz para las cuatro arquitecturas**:
si B0, B1, B2 y B3 responden el mismo contrato, las diferencias que mida el
experimento vienen de la arquitectura y no de haber reimplementado el problema.

Contiene:

| Archivo                                                        | Contrato                                              |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| [`salud.contrato.ts`](src/lib/salud.contrato.ts)               | `GET /health`                                         |
| [`api.contrato.ts`](src/lib/api.contrato.ts)                   | `RUTAS_API` y el cuerpo de error `ErrorApiDto`        |
| [`conversacion.contrato.ts`](src/lib/conversacion.contrato.ts) | envio de mensajes, historial, clasificacion y bloques |
| [`ticket.contrato.ts`](src/lib/ticket.contrato.ts)             | propuesta, confirmacion explicita, rechazo y ticket   |
| [`politica.contrato.ts`](src/lib/politica.contrato.ts)         | citas y politica completa                             |
| [`servicio.contrato.ts`](src/lib/servicio.contrato.ts)         | estado de servicio y ventana estimada                 |

Los contratos de triaje se fijaron **antes** de existir el backend: el frontend
ya funciona contra ellos con datos simulados, y cada arquitectura debe
implementarlos tal cual para que ese mismo frontend funcione contra ella.

```ts
import { RUTAS_API, type RespuestaMensajeDto } from '@unihelp/contratos';
```

No depende de NestJS ni de Angular: solo tipos, para poder usarse desde ambos
lados.

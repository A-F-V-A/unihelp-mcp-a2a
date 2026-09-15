# @unihelp/dominio

Vocabulario de dominio compartido por las cuatro arquitecturas.

| Archivo                                        | Contenido                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`arquitecturas.ts`](src/lib/arquitecturas.ts) | Identificadores B0/B1/B2/B3, protocolos, roles y catalogo descriptivo.                            |
| [`incidentes.ts`](src/lib/incidentes.ts)       | Prioridades, estados del ciclo de vida y areas de servicio.                                       |
| [`triaje.ts`](src/lib/triaje.ts)               | Clasificaciones, niveles de estado de servicio, estados de propuesta, canales y limites de texto. |

**Solo tipos y catalogos.** La logica de triaje (clasificacion, enrutamiento,
priorizacion) es justamente lo que el experimento compara, asi que se implementa
por separado en cada arquitectura: compartirla anularia el estudio.

```ts
import { CATALOGO_ARQUITECTURAS, type Prioridad } from '@unihelp/dominio';
```

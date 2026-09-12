# @unihelp/contratos

DTOs y esquemas tipados que comparten las apps de backend y el frontend.

Es el punto donde se fija **la misma interfaz para las cuatro arquitecturas**:
si B0, B1, B2 y B3 responden el mismo contrato, las diferencias que mida el
experimento vienen de la arquitectura y no de haber reimplementado el problema.

Hoy contiene el contrato del endpoint de salud
([`salud.contrato.ts`](src/lib/salud.contrato.ts)). A medida que se implementen
las historias de usuario se agregan aqui los contratos de triaje.

```ts
import type { RespuestaSalud } from '@unihelp/contratos';
```

No depende de NestJS ni de Angular: solo tipos, para poder usarse desde ambos
lados.

# @unihelp/capacidades

La logica real de las cinco capacidades del agente (busqueda de politica, estado
de servicio, propuesta, confirmacion y creacion de ticket), su registro aditivo,
el invocador del lado del receptor y el puerto **en proceso** que usa B0.

`B1 - B0` solo mide el costo de MCP si la capacidad que se ejecuta es el **mismo
codigo** en ambas (RNF-01). Por eso las capacidades no viven en `apps/b0-directo`
ni en `apps/mcp-server`: viven aqui, y cada uno las alcanza por su transporte. La
libreria no sabe nada de MCP ni de function calling. Los esquemas de entrada y
salida NO se redefinen aqui: son los de `@unihelp/herramientas`, fuente unica.

| Archivo                                                              | Contenido                                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`capacidad.ts`](src/lib/capacidad.ts)                               | Interfaz `Capacidad`: nombre y `ejecutar(argumentos, contexto)`.                             |
| [`capacidades/*.capacidad.ts`](src/lib/capacidades/)                 | Las cinco implementaciones sobre `@unihelp/conocimiento` y `@unihelp/tickets`.               |
| [`capacidades/salidas.spec.ts`](src/lib/capacidades/salidas.spec.ts) | Cada salida cumple el `esquemaSalida` publicado (el cliente MCP de B1 lo valida).            |
| [`registro-capacidades.ts`](src/lib/registro-capacidades.ts)         | Registro con las cinco del contrato; `agregar` aditivo y `alCambiar` para notificar (HU-27). |
| [`invocador-capacidades.ts`](src/lib/invocador-capacidades.ts)       | Puerta del receptor: `EjecutorCapacidad` (limite, validacion, `dur`, auditoria) + registro.  |
| [`capacidades-locales.ts`](src/lib/capacidades-locales.ts)           | `PuertoCapacidades` en proceso (B0): mide `rtt` y normaliza el resultado como si viajara.    |
| [`traducir-fallo.ts`](src/lib/traducir-fallo.ts)                     | Fallo de un caso de uso -> `ErrorHerramienta` con los codigos de docs/02, 5.                 |
| [`capacidades.module.ts`](src/lib/capacidades.module.ts)             | `CapacidadesModule.forRoot({ limiteLlamadas })`; reexporta conocimiento y tickets.           |

## Quien la usa

- **B0** (`apps/b0-directo`): enlaza `PUERTO_CAPACIDADES` con `CapacidadesLocales`.
- **`mcp-server`**: publica `RegistroCapacidades.definiciones` en `tools/list` y
  atiende `tools/call` con `InvocadorCapacidades`.
- **B1** NO la importa: alcanza las capacidades por MCP. Si la importara, la
  comparacion dejaria de medir el transporte.

## Garantias que aporta el registro

- Arranca con exactamente las cinco herramientas de `DEFINICIONES_HERRAMIENTAS`,
  en el orden del contrato.
- `agregar` no toca las existentes, rechaza un nombre repetido y compila el
  esquema nuevo en el validador. La **sexta herramienta no existe**: su
  especificacion esta sellada hasta la semana 8; el mecanismo se prueba con
  `herramienta_de_prueba`, que solo existe en `registro-capacidades.spec.ts`.

## Resultado "como si hubiera viajado"

`CapacidadesLocales` pasa `paraModelo` y `estructurado` por JSON antes de
devolverlos. En B1 el resultado llega serializado desde el servidor MCP; si B0
viera `Date` donde B1 ve una cadena ISO, la traza y el ensamblado de la respuesta
diferirian por algo que no es el transporte.

**Lo que NO contiene**: el bucle del agente, el cliente del modelo ni las rutas
HTTP (`@unihelp/agente-nucleo`); los esquemas y el prompt (`@unihelp/herramientas`).

Dependencias: `@unihelp/herramientas`, `@unihelp/conocimiento`, `@unihelp/tickets`,
`@unihelp/dominio`, `@nestjs/common`. Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend`.

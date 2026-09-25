# mcp-server

Servidor de herramientas MCP compartido (puerto 3010). Publica las cinco
capacidades de [`libs/capacidades`](../../libs/capacidades/README.md), el mismo
codigo que B0 ejecuta en proceso, como herramientas del protocolo para los
agentes que hablan MCP: B1 hoy, los especialistas de B3 despues.

- SDK: `@modelcontextprotocol/sdk` **1.30.1**, especificacion MCP **2025-11-25**.
- Transporte: Streamable HTTP con sesion, en `/mcp` (fuera de `/api`); `/health`
  como las demas apps.
- `tools/list`: nombre, titulo, descripcion, esquema de entrada Y de salida y
  anotaciones, derivados de `DEFINICIONES_HERRAMIENTAS` sin transformar (HU-25,
  HU-26). La respuesta esta versionada en
  [`contrato/tools-list.instantanea.json`](contrato/tools-list.instantanea.json);
  cambiar una herramienta exige regenerarla en el mismo commit:
  `UNIHELP_ACTUALIZAR_INSTANTANEA=1 pnpm nx test mcp-server` (RM-12).
- `tools/call`: pasa por `InvocadorCapacidades` (validacion, limite de llamadas,
  duracion y auditoria). Un error de negocio vuelve con `isError` y su codigo
  identificable (M2.6). El servidor lee `X-Trace-Id` de la cabecera y lo propaga
  a la auditoria (HU-33); reporta su duracion en `_meta` (D5).
- Filtro de privilegios por agente (`X-Agent-Id`): en la condicion B3, el servidor
  valida que el emisor tenga privilegios sobre la herramienta solicitada (`PERMISOS_AGENTE`)
  para prevenir ataques de diputado confundido (HU-20, RNF-04). Si la cabecera falta
  (B1 o inspector MCP), se omiten las restricciones.
- `notifications/tools/list_changed` cuando `RegistroCapacidades` crece (HU-27).
  La sexta herramienta sigue sellada; el mecanismo se prueba con una
  herramienta que solo existe en los specs.

| Archivo                                                                                | Contenido                                                              |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`src/app/mcp/mcp.module.ts`](src/app/mcp/mcp.module.ts)                               | Importa `CapacidadesModule` y registra el servidor.                    |
| [`src/app/mcp/mcp.controller.ts`](src/app/mcp/mcp.controller.ts)                       | `POST`/`GET`/`DELETE /mcp` -> transporte del SDK.                      |
| [`src/app/mcp/sesiones-mcp.ts`](src/app/mcp/sesiones-mcp.ts)                           | Una sesion por cliente; emite `list_changed` a todas.                  |
| [`src/app/mcp/servidor-herramientas-mcp.ts`](src/app/mcp/servidor-herramientas-mcp.ts) | `tools/list`, `tools/call`, contexto de la llamada y `_meta`.          |
| [`src/app/mcp/configuracion-mcp.ts`](src/app/mcp/configuracion-mcp.ts)                 | `UNIHELP_LIMITE_LLAMADAS_HERRAMIENTA` (20).                            |
| [`src/app/mcp/contrato.spec.ts`](src/app/mcp/contrato.spec.ts)                         | Instantanea, equivalencia B0-B1, anotaciones, errores, `list_changed`. |
| [`src/app/mcp/transporte-http.spec.ts`](src/app/mcp/transporte-http.spec.ts)           | Cabecera de traza, sesiones y SSE sobre HTTP real.                     |

Variables: `apps/mcp-server/.env.example`. Diseño completo en
[`apps/b1-mcp-agente/docs/ARQUITECTURA.md`](../b1-mcp-agente/docs/ARQUITECTURA.md)
y decision 42.

# @unihelp/tickets

Registro controlado de tickets de UniHelp: propuesta, confirmacion con token,
creacion, tabla institucional de prioridad y auditoria de solo agregar, sobre
PostgreSQL.

La regla central del experimento en seguridad (H4) es que **sin token de
confirmacion valido no hay escritura**, diga lo que diga el modelo, la persona o
el contenido recuperado (HU-16). Si cada arquitectura implementara esa regla por
su cuenta, M5.1 mediria cuatro implementaciones distintas. Por eso vive aqui y
es el **mismo codigo** para B0 y para `mcp-server` (B1 a B3).

> Estado: la usa B0. `mcp-server` todavia no existe como servidor real.

| Archivo                                                                                                   | Contenido                                                                         |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`tickets.module.ts`](src/tickets.module.ts)                                                              | `TicketsModule.forRoot()`: conexion propia y casos de uso enlazados.              |
| [`dominio/prioridad.ts`](src/dominio/prioridad.ts)                                                        | `P1`-`P4`, equivalencia con `Prioridad` del dominio y `ContextoServicio`.         |
| [`dominio/modelos.ts`](src/dominio/modelos.ts)                                                            | `Propuesta`, `Confirmacion`, `Ticket`, `TurnoUsuario`, `EventoAuditoria`.         |
| [`dominio/errores.ts`](src/dominio/errores.ts)                                                            | `ErrorTickets` con los codigos de docs/02, seccion 5.                             |
| [`dominio/reglas/tabla-prioridad.rules.ts`](src/dominio/reglas/tabla-prioridad.rules.ts)                  | Tabla institucional de docs/01, F-3, y prioridades admisibles.                    |
| [`dominio/reglas/afirmacion.rules.ts`](src/dominio/reglas/afirmacion.rules.ts)                            | Clasificador determinista de afirmacion y clave de transcripcion.                 |
| [`dominio/puertos/tickets.repository.ts`](src/dominio/puertos/tickets.repository.ts)                      | Puerto del repositorio, con transacciones.                                        |
| [`aplicacion/registrar-turno.use-case.ts`](src/aplicacion/registrar-turno.use-case.ts)                    | Registra el texto literal de la persona antes de que el modelo lo vea.            |
| [`aplicacion/proponer-ticket.use-case.ts`](src/aplicacion/proponer-ticket.use-case.ts)                    | Propuesta sin crear ticket; verifica la prioridad contra la tabla (HU-11, HU-13). |
| [`aplicacion/confirmar-propuesta.use-case.ts`](src/aplicacion/confirmar-propuesta.use-case.ts)            | UNICA fuente de tokens: turno real afirmativo o boton explicito (HU-14, HU-15).   |
| [`aplicacion/crear-ticket.use-case.ts`](src/aplicacion/crear-ticket.use-case.ts)                          | Garantia mecanica: crea solo con token valido, idempotente (HU-16, HU-17).        |
| [`aplicacion/consultar-propuestas.use-case.ts`](src/aplicacion/consultar-propuestas.use-case.ts)          | Propuesta pendiente de una conversacion y rechazo desde el frontend.              |
| [`aplicacion/registro-auditoria.ts`](src/aplicacion/registro-auditoria.ts)                                | Unica puerta al registro de auditoria: guarda la huella del cuerpo (RM-09).       |
| [`aplicacion/configuracion.ts`](src/aplicacion/configuracion.ts), [`tokens.ts`](src/aplicacion/tokens.ts) | `TICKETS_DATABASE_URL`, reloj inyectable y tokens de inyeccion.                   |
| [`infraestructura/migraciones/`](src/infraestructura/migraciones/)                                        | Esquemas `tickets` y `auditoria`, con disparador de solo agregar.                 |
| [`infraestructura/typeorm-tickets.repository.ts`](src/infraestructura/typeorm-tickets.repository.ts)      | SQL explicito; toda lectura ordenada declara su desempate (RM-10).                |
| [`infraestructura/data-source.ts`](src/infraestructura/data-source.ts)                                    | Conexion propia y tabla de migraciones `tickets_migraciones`.                     |
| [`infraestructura/cli/tickets.cli.ts`](src/infraestructura/cli/tickets.cli.ts)                            | `pnpm tickets:migrar`.                                                            |

## Garantias

- **Sin token no hay ticket.** `CrearTicketUseCase` exige un token emitido para
  esa propuesta y vigente. Del token solo se guarda su huella SHA-256.
- **El token solo nace de la persona.** Por conversacion, `ConfirmarPropuestaUseCase`
  exige que el texto coincida con un turno que la persona escribio **despues** de
  la propuesta (mismas palabras; se ignoran mayusculas, tildes y puntuacion), y
  que el clasificador lo reconozca como afirmacion. Por el frontend, el boton es
  la accion explicita (decision 13).
- **La auditoria no se puede modificar.** Un disparador rechaza `UPDATE`,
  `DELETE` y `TRUNCATE` sobre `auditoria.eventos` (HU-35). Todo intento, aceptado
  o rechazado, queda con su motivo.
- **La prioridad no se improvisa.** El modelo la escribe y el caso de uso la
  rechaza si ninguna fila de la tabla la respalda (DP-02). En mantenimiento no se
  propone ticket (HU-12).

**Lo que NO contiene**: el restablecimiento de tickets entre ejecuciones ni su
huella (DP-15), los tickets historicos de docs/01 §7 y el reporte agregado de
F-6 (DP-01).

```bash
pnpm conocimiento:db     # la misma base PostgreSQL que la base de conocimiento
pnpm tickets:migrar
```

Dependencias: `@unihelp/dominio`, `@nestjs/common`, `typeorm`, `pg`.
Tags Nx: `tipo:lib`, `arq:compartido`, `alcance:backend`.

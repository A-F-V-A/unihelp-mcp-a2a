import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea dos esquemas con reglas opuestas:
 *
 * - `tickets`: turnos de la persona, propuestas, confirmaciones y tickets. Es
 *   estado de la ejecucion; su restablecimiento queda pendiente (DP-15).
 * - `auditoria`: registro de SOLO AGREGAR. Un disparador impide `UPDATE`,
 *   `DELETE` y `TRUNCATE`, de modo que la regla de HU-35 no dependa del codigo.
 *   Es la fuente independiente contra la que se verifican las escrituras (M5.1).
 *
 * Como en la migracion de conocimiento, los valores de los enum se escriben
 * literales: una migracion aplicada no cambia si cambia el vocabulario.
 */
export class CrearTicketsYAuditoria1789430400000 implements MigrationInterface {
  name = 'CrearTicketsYAuditoria1789430400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const sentencia of SUBIDA) {
      await queryRunner.query(sentencia);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP SCHEMA auditoria CASCADE');
    await queryRunner.query('DROP SCHEMA tickets CASCADE');
  }
}

const SUBIDA: readonly string[] = [
  'CREATE SCHEMA tickets',
  'CREATE SCHEMA auditoria',

  `CREATE TABLE tickets.turnos_usuario (
     id              bigserial PRIMARY KEY,
     conversacion_id text NOT NULL,
     texto           text NOT NULL,
     registrado_en   timestamptz NOT NULL
   )`,
  'CREATE INDEX turnos_usuario_conversacion ON tickets.turnos_usuario (conversacion_id, registrado_en)',

  `CREATE TABLE tickets.propuestas (
     id               uuid PRIMARY KEY,
     conversacion_id  text NOT NULL,
     trace_id         text NOT NULL,
     servicio         text NOT NULL,
     categoria        text NOT NULL CHECK (categoria IN ('acceso','rendimiento','error_funcional','datos','otro')),
     prioridad        text NOT NULL CHECK (prioridad IN ('P1','P2','P3','P4')),
     resumen          text NOT NULL,
     descripcion      text NOT NULL,
     solicitante      text NOT NULL,
     resumen_legible  text NOT NULL,
     campos_faltantes text[] NOT NULL DEFAULT '{}',
     estado           text NOT NULL CHECK (estado IN ('pendiente','confirmada','rechazada')),
     creada_en        timestamptz NOT NULL,
     expira_en        timestamptz NOT NULL,
     resuelta_en      timestamptz,
     ticket_numero    text,
     CHECK ((estado = 'pendiente') = (resuelta_en IS NULL)),
     CHECK ((estado = 'confirmada') = (ticket_numero IS NOT NULL))
   )`,
  'CREATE INDEX propuestas_conversacion ON tickets.propuestas (conversacion_id, estado, creada_en)',

  // Del token solo se guarda la huella: quien lea la base no puede reutilizarlo.
  `CREATE TABLE tickets.confirmaciones (
     propuesta_id  uuid PRIMARY KEY REFERENCES tickets.propuestas (id) ON DELETE RESTRICT,
     token_hash    text NOT NULL,
     via           text NOT NULL CHECK (via IN ('usuario-conversacion','usuario-interfaz')),
     texto         text,
     confirmada_en timestamptz NOT NULL,
     expira_en     timestamptz NOT NULL
   )`,

  'CREATE SEQUENCE tickets.secuencia_ticket START 1',
  // UNIQUE en propuesta_id: una propuesta produce como maximo un ticket (RN-03).
  `CREATE TABLE tickets.tickets (
     numero          text PRIMARY KEY,
     propuesta_id    uuid NOT NULL UNIQUE REFERENCES tickets.propuestas (id) ON DELETE RESTRICT,
     conversacion_id text NOT NULL,
     trace_id        text NOT NULL,
     servicio        text NOT NULL,
     categoria       text NOT NULL,
     prioridad       text NOT NULL CHECK (prioridad IN ('P1','P2','P3','P4')),
     estado          text NOT NULL,
     creado_en       timestamptz NOT NULL
   )`,

  `CREATE TABLE auditoria.eventos (
     id           bigserial PRIMARY KEY,
     trace_id     text NOT NULL,
     actor        text NOT NULL,
     accion       text NOT NULL,
     recurso      text NOT NULL,
     resultado    text NOT NULL CHECK (resultado IN ('OK','RECHAZADO','ERROR')),
     motivo       text,
     token_valido boolean,
     payload_hash text NOT NULL CHECK (payload_hash ~ '^sha256:[0-9a-f]{64}$'),
     ocurrido_en  timestamptz NOT NULL DEFAULT clock_timestamp(),
     CHECK (resultado = 'OK' OR motivo IS NOT NULL)
   )`,
  'CREATE INDEX eventos_trace ON auditoria.eventos (trace_id, id)',

  `CREATE FUNCTION auditoria.impedir_modificacion() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     RAISE EXCEPTION 'auditoria.eventos es de solo agregar: % no permitido', TG_OP;
   END
   $$`,
  `CREATE TRIGGER eventos_solo_agregar BEFORE UPDATE OR DELETE ON auditoria.eventos
     FOR EACH ROW EXECUTE FUNCTION auditoria.impedir_modificacion()`,
  `CREATE TRIGGER eventos_sin_truncate BEFORE TRUNCATE ON auditoria.eventos
     FOR EACH STATEMENT EXECUTE FUNCTION auditoria.impedir_modificacion()`,
];

import type { DataSource, EntityManager } from 'typeorm';
import type {
  CategoriaTicket,
  Confirmacion,
  EventoAuditoria,
  Propuesta,
  Ticket,
  TurnoUsuario,
} from '../dominio/modelos';
import type { CodigoPrioridad } from '../dominio/prioridad';
import type { CambiosPropuesta, TicketsRepository } from '../dominio/puertos/tickets.repository';

type Fila = Record<string, unknown>;

const COLUMNAS_PROPUESTA = `id, conversacion_id, trace_id, servicio, categoria, prioridad, resumen,
  descripcion, solicitante, resumen_legible, campos_faltantes, estado, creada_en, expira_en,
  resuelta_en, ticket_numero`;

/**
 * Implementacion PostgreSQL del registro de tickets, en SQL explicito. Toda
 * lectura con mas de una fila declara su orden completo (RM-10).
 */
export class TypeOrmTicketsRepository implements TicketsRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly manager: EntityManager | null = null,
  ) {}

  async transaccion<T>(fn: (repositorio: TicketsRepository) => Promise<T>): Promise<T> {
    if (this.manager !== null) {
      return fn(this);
    }
    return this.dataSource.transaction((manager) =>
      fn(new TypeOrmTicketsRepository(this.dataSource, manager)),
    );
  }

  async registrarTurno(turno: TurnoUsuario): Promise<void> {
    await this.query(
      `INSERT INTO tickets.turnos_usuario (conversacion_id, texto, registrado_en) VALUES ($1, $2, $3)`,
      [turno.conversacionId, turno.texto, turno.registradoEn],
    );
  }

  async listarTurnos(conversacionId: string, desde: Date): Promise<readonly TurnoUsuario[]> {
    const filas = await this.query(
      `SELECT conversacion_id, texto, registrado_en FROM tickets.turnos_usuario
        WHERE conversacion_id = $1 AND registrado_en >= $2
        ORDER BY registrado_en ASC, id ASC`,
      [conversacionId, desde],
    );
    return filas.map((f) => ({
      conversacionId: String(f['conversacion_id']),
      texto: String(f['texto']),
      registradoEn: fecha(f['registrado_en']),
    }));
  }

  async guardarPropuesta(p: Propuesta): Promise<void> {
    await this.query(
      `INSERT INTO tickets.propuestas (${COLUMNAS_PROPUESTA})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        p.id,
        p.conversacionId,
        p.traceId,
        p.servicio,
        p.categoria,
        p.prioridad,
        p.resumen,
        p.descripcion,
        p.solicitante,
        p.resumenLegible,
        p.camposFaltantes,
        p.estado,
        p.creadaEn,
        p.expiraEn,
        p.resueltaEn,
        p.ticketNumero,
      ],
    );
  }

  async obtenerPropuesta(id: string): Promise<Propuesta | null> {
    return this.unaPropuesta(`SELECT ${COLUMNAS_PROPUESTA} FROM tickets.propuestas WHERE id = $1`, [
      id,
    ]);
  }

  async bloquearPropuesta(id: string): Promise<Propuesta | null> {
    return this.unaPropuesta(
      `SELECT ${COLUMNAS_PROPUESTA} FROM tickets.propuestas WHERE id = $1 FOR UPDATE`,
      [id],
    );
  }

  async ultimaPropuestaPendiente(conversacionId: string): Promise<Propuesta | null> {
    return this.unaPropuesta(
      `SELECT ${COLUMNAS_PROPUESTA} FROM tickets.propuestas
        WHERE conversacion_id = $1 AND estado = 'pendiente'
        ORDER BY creada_en DESC, id::text COLLATE "C" DESC
        LIMIT 1`,
      [conversacionId],
    );
  }

  async actualizarPropuesta(id: string, cambios: CambiosPropuesta): Promise<void> {
    await this.query(
      `UPDATE tickets.propuestas SET estado = $2, resuelta_en = $3, ticket_numero = $4 WHERE id = $1`,
      [id, cambios.estado, cambios.resueltaEn, cambios.ticketNumero],
    );
  }

  async guardarConfirmacion(c: Confirmacion): Promise<void> {
    await this.query(
      `INSERT INTO tickets.confirmaciones (propuesta_id, token_hash, via, texto, confirmada_en, expira_en)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (propuesta_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, via = EXCLUDED.via,
         texto = EXCLUDED.texto, confirmada_en = EXCLUDED.confirmada_en, expira_en = EXCLUDED.expira_en`,
      [c.propuestaId, c.tokenHash, c.via, c.texto, c.confirmadaEn, c.expiraEn],
    );
  }

  async obtenerConfirmacion(propuestaId: string): Promise<Confirmacion | null> {
    const [f] = await this.query(
      `SELECT propuesta_id, token_hash, via, texto, confirmada_en, expira_en
         FROM tickets.confirmaciones WHERE propuesta_id = $1`,
      [propuestaId],
    );
    if (f === undefined) {
      return null;
    }
    return {
      propuestaId: String(f['propuesta_id']),
      tokenHash: String(f['token_hash']),
      via: f['via'] as Confirmacion['via'],
      texto: f['texto'] === null ? null : String(f['texto']),
      confirmadaEn: fecha(f['confirmada_en']),
      expiraEn: fecha(f['expira_en']),
    };
  }

  async siguienteNumeroTicket(): Promise<number> {
    const [f] = await this.query(`SELECT nextval('tickets.secuencia_ticket') AS n`, []);
    return Number(f?.['n']);
  }

  async guardarTicket(t: Ticket): Promise<void> {
    await this.query(
      `INSERT INTO tickets.tickets (numero, propuesta_id, conversacion_id, trace_id, servicio,
         categoria, prioridad, estado, creado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        t.numero,
        t.propuestaId,
        t.conversacionId,
        t.traceId,
        t.servicio,
        t.categoria,
        t.prioridad,
        t.estado,
        t.creadoEn,
      ],
    );
  }

  async obtenerTicketDePropuesta(propuestaId: string): Promise<Ticket | null> {
    const [f] = await this.query(
      `SELECT numero, propuesta_id, conversacion_id, trace_id, servicio, categoria, prioridad,
              estado, creado_en
         FROM tickets.tickets WHERE propuesta_id = $1`,
      [propuestaId],
    );
    if (f === undefined) {
      return null;
    }
    return {
      numero: String(f['numero']),
      propuestaId: String(f['propuesta_id']),
      conversacionId: String(f['conversacion_id']),
      traceId: String(f['trace_id']),
      servicio: String(f['servicio']),
      categoria: f['categoria'] as CategoriaTicket,
      prioridad: f['prioridad'] as CodigoPrioridad,
      estado: f['estado'] as Ticket['estado'],
      creadoEn: fecha(f['creado_en']),
    };
  }

  async registrarEvento(e: EventoAuditoria): Promise<void> {
    await this.query(
      `INSERT INTO auditoria.eventos (trace_id, actor, accion, recurso, resultado, motivo,
         token_valido, payload_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        e.traceId,
        e.actor,
        e.accion,
        e.recurso,
        e.resultado,
        e.motivo,
        e.tokenValido,
        e.payloadHash,
      ],
    );
  }

  async listarEventos(traceId: string): Promise<readonly EventoAuditoria[]> {
    const filas = await this.query(
      `SELECT trace_id, actor, accion, recurso, resultado, motivo, token_valido, payload_hash
         FROM auditoria.eventos WHERE trace_id = $1 ORDER BY id ASC`,
      [traceId],
    );
    return filas.map((f) => ({
      traceId: String(f['trace_id']),
      actor: String(f['actor']),
      accion: String(f['accion']),
      recurso: String(f['recurso']),
      resultado: f['resultado'] as EventoAuditoria['resultado'],
      motivo: f['motivo'] === null ? null : String(f['motivo']),
      tokenValido: f['token_valido'] === null ? null : Boolean(f['token_valido']),
      payloadHash: String(f['payload_hash']),
    }));
  }

  async listarTicketsDeTrace(traceId: string): Promise<readonly Ticket[]> {
    const filas = await this.query(
      `SELECT numero, propuesta_id, conversacion_id, trace_id, servicio, categoria, prioridad,
              estado, creado_en
         FROM tickets.tickets WHERE trace_id = $1 ORDER BY numero COLLATE "C" ASC`,
      [traceId],
    );
    return filas.map((f) => ({
      numero: String(f['numero']),
      propuestaId: String(f['propuesta_id']),
      conversacionId: String(f['conversacion_id']),
      traceId: String(f['trace_id']),
      servicio: String(f['servicio']),
      categoria: f['categoria'] as CategoriaTicket,
      prioridad: f['prioridad'] as CodigoPrioridad,
      estado: f['estado'] as Ticket['estado'],
      creadoEn: fecha(f['creado_en']),
    }));
  }

  /**
   * Un solo TRUNCATE de las cuatro tablas de `tickets`, sin nombrar
   * `auditoria.eventos`: su disparador aborta cualquier TRUNCATE y con el se
   * perderia la fuente independiente de M5.1 (HU-35, decision 31).
   */
  async vaciarRegistro(): Promise<void> {
    await this.query(
      `TRUNCATE tickets.tickets, tickets.confirmaciones, tickets.propuestas,
                tickets.turnos_usuario RESTART IDENTITY`,
      [],
    );
    await this.query(`ALTER SEQUENCE tickets.secuencia_ticket RESTART WITH 1`, []);
  }

  private async unaPropuesta(sql: string, parametros: unknown[]): Promise<Propuesta | null> {
    const [f] = await this.query(sql, parametros);
    return f === undefined ? null : aPropuesta(f);
  }

  private query(sql: string, parametros: unknown[]): Promise<Fila[]> {
    return (this.manager ?? this.dataSource).query(sql, parametros);
  }
}

function fecha(valor: unknown): Date {
  return valor instanceof Date ? valor : new Date(String(valor));
}

function aPropuesta(f: Fila): Propuesta {
  return {
    id: String(f['id']),
    conversacionId: String(f['conversacion_id']),
    traceId: String(f['trace_id']),
    servicio: String(f['servicio']),
    categoria: f['categoria'] as CategoriaTicket,
    prioridad: f['prioridad'] as CodigoPrioridad,
    resumen: String(f['resumen']),
    descripcion: String(f['descripcion']),
    solicitante: String(f['solicitante']),
    resumenLegible: String(f['resumen_legible']),
    camposFaltantes: (f['campos_faltantes'] as string[] | null) ?? [],
    estado: f['estado'] as Propuesta['estado'],
    creadaEn: fecha(f['creada_en']),
    expiraEn: fecha(f['expira_en']),
    resueltaEn: f['resuelta_en'] === null ? null : fecha(f['resuelta_en']),
    ticketNumero: f['ticket_numero'] === null ? null : String(f['ticket_numero']),
  };
}

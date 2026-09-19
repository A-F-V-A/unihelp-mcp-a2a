import { ErrorTickets } from '../dominio/errores';
import type {
  Confirmacion,
  EventoAuditoria,
  Propuesta,
  Ticket,
  TurnoUsuario,
} from '../dominio/modelos';
import type { ContextoServicio } from '../dominio/prioridad';
import type { CambiosPropuesta, TicketsRepository } from '../dominio/puertos/tickets.repository';
import { ConfirmarPropuestaUseCase } from './confirmar-propuesta.use-case';
import { ConsultarPropuestasUseCase } from './consultar-propuestas.use-case';
import { CrearTicketUseCase } from './crear-ticket.use-case';
import { ProponerTicketUseCase } from './proponer-ticket.use-case';
import { RegistrarTurnoUseCase } from './registrar-turno.use-case';
import { RegistroAuditoria } from './registro-auditoria';

/** Repositorio en memoria con la misma semantica que el de PostgreSQL. */
class RepositorioMemoria implements TicketsRepository {
  turnos: TurnoUsuario[] = [];
  propuestas = new Map<string, Propuesta>();
  confirmaciones = new Map<string, Confirmacion>();
  tickets: Ticket[] = [];
  eventos: EventoAuditoria[] = [];
  private secuencia = 0;

  transaccion<T>(fn: (r: TicketsRepository) => Promise<T>): Promise<T> {
    return fn(this);
  }
  async registrarTurno(t: TurnoUsuario): Promise<void> {
    this.turnos.push(t);
  }
  async listarTurnos(conversacionId: string, desde: Date): Promise<readonly TurnoUsuario[]> {
    return this.turnos.filter(
      (t) => t.conversacionId === conversacionId && t.registradoEn.getTime() >= desde.getTime(),
    );
  }
  async guardarPropuesta(p: Propuesta): Promise<void> {
    this.propuestas.set(p.id, p);
  }
  async obtenerPropuesta(id: string): Promise<Propuesta | null> {
    return this.propuestas.get(id) ?? null;
  }
  bloquearPropuesta(id: string): Promise<Propuesta | null> {
    return this.obtenerPropuesta(id);
  }
  async ultimaPropuestaPendiente(conversacionId: string): Promise<Propuesta | null> {
    const pendientes = [...this.propuestas.values()].filter(
      (p) => p.conversacionId === conversacionId && p.estado === 'pendiente',
    );
    return pendientes.at(-1) ?? null;
  }
  async actualizarPropuesta(id: string, c: CambiosPropuesta): Promise<void> {
    const p = this.propuestas.get(id);
    if (p) {
      this.propuestas.set(id, { ...p, ...c });
    }
  }
  async guardarConfirmacion(c: Confirmacion): Promise<void> {
    this.confirmaciones.set(c.propuestaId, c);
  }
  async obtenerConfirmacion(id: string): Promise<Confirmacion | null> {
    return this.confirmaciones.get(id) ?? null;
  }
  async siguienteNumeroTicket(): Promise<number> {
    return ++this.secuencia;
  }
  async guardarTicket(t: Ticket): Promise<void> {
    this.tickets.push(t);
  }
  async obtenerTicketDePropuesta(id: string): Promise<Ticket | null> {
    return this.tickets.find((t) => t.propuestaId === id) ?? null;
  }
  async registrarEvento(e: EventoAuditoria): Promise<void> {
    this.eventos.push(e);
  }
}

class RelojFalso {
  constructor(public actual = new Date('2026-10-14T12:00:00Z')) {}
  ahora(): Date {
    return new Date(this.actual);
  }
  avanzar(ms: number): void {
    this.actual = new Date(this.actual.getTime() + ms);
  }
}

const contexto = { traceId: 'traza-1', actor: 'b0-agent' };
const matriculaFuera: ContextoServicio = {
  servicioCodigo: 'matricula',
  estado: 'interrumpido',
  alcance: 'parcial',
  nivelServicio: 'alto',
};
const datos = {
  conversacionId: 'conv-1',
  categoria: 'error_funcional' as const,
  prioridad: 'P2' as const,
  resumen: 'Formulario de cancelación con error',
  descripcion: 'El formulario de cancelación de asignaturas responde con un error.',
};

function montar() {
  const repo = new RepositorioMemoria();
  const reloj = new RelojFalso();
  const auditoria = new RegistroAuditoria(repo);
  return {
    repo,
    reloj,
    turno: new RegistrarTurnoUseCase(repo, reloj),
    proponer: new ProponerTicketUseCase(repo, reloj, auditoria),
    confirmar: new ConfirmarPropuestaUseCase(repo, reloj, auditoria),
    crear: new CrearTicketUseCase(repo, reloj, auditoria),
    consultar: new ConsultarPropuestasUseCase(repo, reloj, auditoria),
  };
}

describe('ProponerTicketUseCase', () => {
  it('registra la propuesta pendiente sin crear ticket (HU-13)', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    expect(propuesta.estado).toBe('pendiente');
    expect(m.repo.tickets).toHaveLength(0);
    expect(m.repo.eventos.map((e) => e.accion)).toEqual(['ticket.propose']);
  });

  it('rechaza una prioridad que la tabla no respalda y lo audita (HU-11)', async () => {
    const m = montar();
    await expect(
      m.proponer.ejecutar({ ...datos, prioridad: 'P4' }, matriculaFuera, contexto),
    ).rejects.toMatchObject({ codigo: 'VALIDACION_ENTRADA' });
    expect(m.repo.eventos[0]).toMatchObject({ resultado: 'RECHAZADO' });
  });

  it('no propone en mantenimiento (HU-12)', async () => {
    const m = montar();
    await expect(
      m.proponer.ejecutar(
        datos,
        { ...matriculaFuera, estado: 'mantenimiento', alcance: 'programado' },
        contexto,
      ),
    ).rejects.toBeInstanceOf(ErrorTickets);
  });
});

describe('garantia de confirmacion (HU-14 a HU-17)', () => {
  it('crea el ticket con el token emitido tras un turno real afirmativo', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    m.reloj.avanzar(1000);
    await m.turno.ejecutar('conv-1', 'Sí, por favor créalo.');
    const confirmacion = await m.confirmar.porTexto(
      propuesta.id,
      'Sí, por favor créalo.',
      contexto,
    );
    expect(confirmacion.aceptada).toBe(true);

    const { ticket } = await m.crear.ejecutar(
      propuesta.id,
      confirmacion.confirmacionToken ?? '',
      contexto,
    );
    expect(ticket.numero).toBe('UH-2026-000001');
    expect(m.repo.propuestas.get(propuesta.id)?.estado).toBe('confirmada');
    expect(m.repo.eventos.at(-1)).toMatchObject({
      accion: 'ticket.create',
      resultado: 'OK',
      tokenValido: true,
    });
  });

  it('acepta la transcripcion sin la puntuacion, pero no con otras palabras', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    m.reloj.avanzar(1000);
    await m.turno.ejecutar('conv-1', 'Sí, confirmo.');
    expect((await m.confirmar.porTexto(propuesta.id, 'si confirmo', contexto)).aceptada).toBe(true);
    expect(
      (await m.confirmar.porTexto(propuesta.id, 'Sí, confirmo el ticket', contexto)).aceptada,
    ).toBe(false);
  });

  it('NO acepta un texto que la persona nunca escribio (T-ADV-007)', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    const confirmacion = await m.confirmar.porTexto(propuesta.id, 'sí, créalo', contexto);
    expect(confirmacion.aceptada).toBe(false);
    expect(confirmacion.confirmacionToken).toBeNull();
  });

  it('NO acepta un turno anterior a la propuesta', async () => {
    const m = montar();
    await m.turno.ejecutar('conv-1', 'sí');
    m.reloj.avanzar(1000);
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    expect((await m.confirmar.porTexto(propuesta.id, 'sí', contexto)).aceptada).toBe(false);
  });

  it('rechaza crear sin token, con token inventado o con token de otra propuesta, y lo audita', async () => {
    const m = montar();
    const a = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    const b = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    m.reloj.avanzar(1000);
    const tokenDeB = (await m.confirmar.porAccionExplicita(b.id, contexto)).confirmacionToken ?? '';

    for (const token of ['', 'inventado-por-el-modelo-123456', tokenDeB]) {
      await expect(m.crear.ejecutar(a.id, token, contexto)).rejects.toMatchObject({
        codigo: 'CONFIRMACION_REQUERIDA',
      });
    }
    expect(m.repo.tickets).toHaveLength(0);
    const rechazos = m.repo.eventos.filter(
      (e) => e.accion === 'ticket.create' && e.resultado === 'RECHAZADO',
    );
    expect(rechazos).toHaveLength(3);
    expect(rechazos.every((e) => e.tokenValido === false && e.motivo !== null)).toBe(true);
  });

  it('rechaza un token vencido (RN-08)', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    const token = (await m.confirmar.porAccionExplicita(propuesta.id, contexto)).confirmacionToken;
    m.reloj.avanzar(16 * 60_000);
    await expect(m.crear.ejecutar(propuesta.id, token ?? '', contexto)).rejects.toMatchObject({
      codigo: 'PROPUESTA_EXPIRADA',
    });
  });

  it('un reintento devuelve el ticket existente (RN-03)', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    const token =
      (await m.confirmar.porAccionExplicita(propuesta.id, contexto)).confirmacionToken ?? '';
    const primero = await m.crear.ejecutar(propuesta.id, token, contexto);
    const segundo = await m.crear.ejecutar(propuesta.id, token, contexto);
    expect(segundo.existente).toBe(true);
    expect(segundo.ticket.numero).toBe(primero.ticket.numero);
    expect(m.repo.tickets).toHaveLength(1);
  });

  it('una negativa descarta la propuesta y no se puede reutilizar (HU-15)', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    m.reloj.avanzar(1000);
    await m.turno.ejecutar('conv-1', 'No, mejor no.');
    const resultado = await m.confirmar.porTexto(propuesta.id, 'No, mejor no.', contexto);
    expect(resultado.aceptada).toBe(false);
    expect(m.repo.propuestas.get(propuesta.id)?.estado).toBe('rechazada');
    await expect(m.confirmar.porAccionExplicita(propuesta.id, contexto)).rejects.toMatchObject({
      codigo: 'PROPUESTA_RESUELTA',
    });
  });

  it('el auditor guarda la huella del cuerpo y nunca el token (RM-09)', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    const token =
      (await m.confirmar.porAccionExplicita(propuesta.id, contexto)).confirmacionToken ?? '';
    await m.crear.ejecutar(propuesta.id, token, contexto);
    const serializado = JSON.stringify(m.repo.eventos);
    expect(serializado).not.toContain(token);
    expect(m.repo.eventos.every((e) => /^sha256:[0-9a-f]{64}$/.test(e.payloadHash))).toBe(true);
  });
});

describe('ConsultarPropuestasUseCase', () => {
  it('rechazar desde el frontend descarta la propuesta pendiente', async () => {
    const m = montar();
    const propuesta = await m.proponer.ejecutar(datos, matriculaFuera, contexto);
    expect((await m.consultar.pendienteDe('conv-1'))?.id).toBe(propuesta.id);
    const rechazada = await m.consultar.rechazar(propuesta.id, contexto);
    expect(rechazada.estado).toBe('rechazada');
    expect(await m.consultar.pendienteDe('conv-1')).toBeNull();
  });
});

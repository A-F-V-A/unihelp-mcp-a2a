import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  CHAT_REPOSITORY,
  POLITICA_REPOSITORY,
  SERVICIO_REPOSITORY,
  TICKET_REPOSITORY,
} from '../../application/di/tokens';
import { ErrorBackend } from '../../domain/errors/error-backend';
import { CONFIGURACION_APP } from '../../nucleo/configuracion';
import { provideDataLayer } from '../provide-data-layer';
import {
  CONFIGURACION_SIMULACION_POR_DEFECTO,
  type ConfiguracionSimulacion,
  leerSobrescriturasUrl,
} from './configuracion-simulacion';
import { calcularLatencia, leerDirectivaError } from './simulador-red';

const SIN_LATENCIA: Partial<ConfiguracionSimulacion> = {
  latenciaMinimaMs: 0,
  latenciaMaximaMs: 0,
  esperaTimeoutMs: 0,
  persistirEnSesion: false,
  sembrarConversaciones: false,
};

function configurar(simulacion: Partial<ConfiguracionSimulacion> = {}) {
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: CONFIGURACION_APP, useValue: { backendUrl: 'http://no-se-usa' } },
      provideDataLayer({ useMockBackend: true, simulacion: { ...SIN_LATENCIA, ...simulacion } }),
    ],
  });
  return {
    chat: TestBed.inject(CHAT_REPOSITORY),
    tickets: TestBed.inject(TICKET_REPOSITORY),
    politicas: TestBed.inject(POLITICA_REPOSITORY),
    servicios: TestBed.inject(SERVICIO_REPOSITORY),
  };
}

async function capturarError(promesa: Promise<unknown>): Promise<ErrorBackend> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(ErrorBackend);
    return error as ErrorBackend;
  }
  throw new Error('Se esperaba un ErrorBackend');
}

describe('simulacion de red (HU-FE-02)', () => {
  it('por defecto la latencia va de 300 a 1500 ms', () => {
    const { latenciaMinimaMs, latenciaMaximaMs } = CONFIGURACION_SIMULACION_POR_DEFECTO;
    expect([latenciaMinimaMs, latenciaMaximaMs]).toEqual([300, 1500]);
    expect(calcularLatencia(0, 300, 1500)).toBe(300);
    expect(calcularLatencia(0.5, 300, 1500)).toBe(900);
    expect(calcularLatencia(0.9999, 300, 1500)).toBeLessThanOrEqual(1500);
  });

  it('lee directivas de error escritas en el chat', () => {
    expect(leerDirectivaError('falla #timeout')).toBe('timeout');
    expect(leerDirectivaError('falla #no-disponible')).toBe('servicio-no-disponible');
    expect(leerDirectivaError('sin directiva')).toBeNull();
  });

  it('acepta sobrescrituras por query string', () => {
    expect(
      leerSobrescriturasUrl(
        '?simular-error=interno&simular-error-en=confirmarTicket&tasa-error=0.5&turnos-maximos=3',
      ),
    ).toEqual({
      errorForzado: { codigo: 'interno', operacion: 'confirmarTicket' },
      probabilidadError: 0.5,
      turnosMaximos: 3,
    });
    expect(leerSobrescriturasUrl('?simular-error=inventado')).toEqual({});
  });
});

describe('MockChatRepository', () => {
  it.each([
    ['¿Hasta cuándo puedo cancelar una asignatura?', 'informativa', null],
    ['El aula virtual no carga y no puedo entregar la tarea', 'diagnostico', 'proponer-ticket'],
    ['No puedo pagar la matrícula por PSE', 'compuesta', 'proponer-ticket'],
    ['¿Cuál es el menú del restaurante hoy?', 'fuera-de-alcance', null],
  ] as const)('"%s" se clasifica como %s', async (texto, tipo, accion) => {
    const { chat } = configurar();
    const respuesta = await chat.enviarMensaje({ conversacionId: null, texto });

    expect(respuesta.respuesta.clasificacion?.tipo).toBe(tipo);
    expect(respuesta.accionSugerida).toBe(accion);
    expect(respuesta.mensajeUsuario.turno).toBe(1);
    expect(respuesta.respuesta.enviadoEn).toBeInstanceOf(Date);
  });

  it('mantiene la conversacion y cuenta turnos', async () => {
    const { chat } = configurar();
    const primero = await chat.enviarMensaje({
      conversacionId: null,
      texto: 'Los correos no salen',
    });
    const segundo = await chat.enviarMensaje({
      conversacionId: primero.conversacionId,
      texto: 'Desde las 8 de la mañana',
    });

    expect(segundo.conversacionId).toBe(primero.conversacionId);
    expect(segundo.turnos).toEqual({ usados: 2, maximos: 8 });

    const historial = await chat.obtenerHistorial(primero.conversacionId);
    expect(historial.mensajes.map((m) => m.rol)).toEqual([
      'usuario',
      'asistente',
      'usuario',
      'asistente',
    ]);
  });

  it('rechaza con limite-turnos al superar el maximo (RNF-04)', async () => {
    const { chat } = configurar({ turnosMaximos: 1 });
    const { conversacionId } = await chat.enviarMensaje({
      conversacionId: null,
      texto: 'Los correos no salen',
    });

    const error = await capturarError(
      chat.enviarMensaje({ conversacionId, texto: 'Sigue sin funcionar el correo' }),
    );
    expect(error.codigo).toBe('limite-turnos');
    expect(error.detalles['turnosMaximos']).toBe(1);
  });

  it('falla a proposito con directivas y con error forzado', async () => {
    const { chat } = configurar();
    const timeout = await capturarError(
      chat.enviarMensaje({ conversacionId: null, texto: 'prueba de fallo #timeout' }),
    );
    expect([timeout.codigo, timeout.reintentable]).toEqual(['timeout', true]);

    const validacion = await capturarError(
      chat.enviarMensaje({ conversacionId: null, texto: 'prueba de fallo #validacion' }),
    );
    expect([validacion.codigo, validacion.reintentable]).toEqual(['validacion', false]);
  });

  it('historial inexistente -> no-encontrado', async () => {
    const { chat } = configurar();
    expect((await capturarError(chat.obtenerHistorial('conv-fantasma'))).codigo).toBe(
      'no-encontrado',
    );
  });
});

describe('MockChatRepository: varias conversaciones', () => {
  it('arranca con conversaciones previas de distintas fechas', async () => {
    const { chat } = configurar({ sembrarConversaciones: true });

    const lista = await chat.listarConversaciones();

    expect(lista.map((c) => c.titulo)).toEqual([
      'Correo institucional sin envío',
      'Cancelar una asignatura',
      'Renovar libros en la biblioteca',
      'Reembolso por doble cobro',
    ]);
    const historial = await chat.obtenerHistorial(lista[0].id);
    expect(historial.mensajes.map((m) => m.rol)).toEqual([
      'usuario',
      'asistente',
      'usuario',
      'asistente',
    ]);
  });

  it('titula las conversaciones nuevas, las ordena y permite eliminarlas', async () => {
    const { chat } = configurar();

    const pago = await chat.enviarMensaje({
      conversacionId: null,
      texto: 'No puedo pagar la matrícula por PSE',
    });
    expect(pago.conversacion).toEqual(
      expect.objectContaining({ id: pago.conversacionId, titulo: 'Pago de matrícula por PSE' }),
    );

    const libre = await chat.enviarMensaje({
      conversacionId: null,
      texto:
        '¿Me pueden ayudar con un trámite muy particular que tengo pendiente desde hace semanas?',
    });
    expect(libre.conversacion.titulo.endsWith('…')).toBe(true);

    expect((await chat.listarConversaciones()).map((c) => c.id)).toEqual([
      libre.conversacionId,
      pago.conversacionId,
    ]);

    await chat.eliminarConversacion(pago.conversacionId);

    expect((await chat.listarConversaciones()).map((c) => c.id)).toEqual([libre.conversacionId]);
    expect((await capturarError(chat.obtenerHistorial(pago.conversacionId))).codigo).toBe(
      'no-encontrado',
    );
  });
});

describe('MockTicketRepository (HU-FE-16 a HU-FE-19)', () => {
  async function conversacionConDiagnostico(texto = 'El aula virtual no carga') {
    const repos = configurar();
    const { conversacionId } = await repos.chat.enviarMensaje({ conversacionId: null, texto });
    return { ...repos, conversacionId };
  }

  it('propone sin crear ticket y confirma solo con confirmacion explicita', async () => {
    const { tickets, chat, conversacionId } = await conversacionConDiagnostico();

    const propuesta = await tickets.proponerTicket({ conversacionId });
    expect(propuesta).toMatchObject({
      estado: 'pendiente',
      servicio: 'plataforma-virtual',
      ticketNumero: null,
    });
    expect(propuesta.descripcion).toContain('El aula virtual no carga');

    const ticket = await tickets.confirmarTicket({
      propuestaId: propuesta.id,
      origen: 'accion-usuario',
    });
    expect(ticket.numero).toBe('UH-2026-001208');
    expect(ticket.estado).toBe('asignado');

    const historial = await chat.obtenerHistorial(conversacionId);
    const bloques = historial.mensajes.flatMap((m) => (m.rol === 'asistente' ? m.bloques : []));
    const bloquePropuesta = bloques.find((b) => b.tipo === 'propuesta-ticket');
    expect(bloquePropuesta?.tipo === 'propuesta-ticket' && bloquePropuesta.propuesta.estado).toBe(
      'confirmada',
    );
    expect(bloques.some((b) => b.tipo === 'ticket-creado')).toBe(true);
  });

  it('una propuesta rechazada no se puede volver a confirmar', async () => {
    const { tickets, conversacionId } = await conversacionConDiagnostico();
    const propuesta = await tickets.proponerTicket({ conversacionId });

    const rechazada = await tickets.rechazarTicket(propuesta.id);
    expect(rechazada.estado).toBe('rechazada');

    const error = await capturarError(
      tickets.confirmarTicket({ propuestaId: propuesta.id, origen: 'accion-usuario' }),
    );
    expect(error.codigo).toBe('conflicto');
  });

  it('varia el estado inicial del ticket segun el diagnostico', async () => {
    const { tickets, conversacionId } = await conversacionConDiagnostico('Los correos no salen');
    const propuesta = await tickets.proponerTicket({ conversacionId });
    const ticket = await tickets.confirmarTicket({
      propuestaId: propuesta.id,
      origen: 'accion-usuario',
    });
    expect([ticket.prioridad, ticket.estado]).toEqual(['critica', 'en-triaje']);
  });

  it('sin diagnostico previo no hay propuesta', async () => {
    const { chat, tickets } = configurar();
    const { conversacionId } = await chat.enviarMensaje({
      conversacionId: null,
      texto: '¿Hasta cuándo puedo cancelar una asignatura?',
    });
    expect((await capturarError(tickets.proponerTicket({ conversacionId }))).codigo).toBe(
      'validacion',
    );
  });
});

describe('MockPoliticaRepository y MockServicioRepository', () => {
  it('busca politicas por codigo y version', async () => {
    const { politicas } = configurar();
    const politica = await politicas.buscarPolitica({ codigo: 'PA-REG-012', version: '3.1' });
    expect(politica.vigenteDesde).toBeInstanceOf(Date);
    expect(politica.contenido.length).toBeGreaterThan(0);

    const error = await capturarError(
      politicas.buscarPolitica({ codigo: 'PA-REG-012', version: '1.0' }),
    );
    expect(error.codigo).toBe('no-encontrado');
    expect(error.detalles['versionVigente']).toBe('3.1');
  });

  it('cubre servicios con y sin ventana estimada', async () => {
    const { servicios } = configurar();
    const plataforma = await servicios.consultarEstado('plataforma-virtual');
    const correo = await servicios.consultarEstado('soporte-tecnico');

    expect(plataforma.ventanaEstimada?.fin.getTime()).toBeGreaterThan(Date.now());
    expect(correo).toMatchObject({ estado: 'interrumpido', ventanaEstimada: null });
  });

  it('el error forzado puede limitarse a una operacion', async () => {
    const { servicios, politicas } = configurar({
      errorForzado: { codigo: 'servicio-no-disponible', operacion: 'consultarEstado' },
    });
    expect((await capturarError(servicios.consultarEstado('biblioteca'))).codigo).toBe(
      'servicio-no-disponible',
    );
    await expect(politicas.buscarPolitica({ codigo: 'PA-BIB-003' })).resolves.toBeTruthy();
  });
});

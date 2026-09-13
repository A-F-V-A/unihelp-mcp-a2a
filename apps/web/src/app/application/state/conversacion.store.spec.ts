import { TestBed } from '@angular/core/testing';
import { ErrorBackend } from '../../domain/errors/error-backend';
import type { MensajeAsistente, RespuestaMensaje } from '../../domain/models/conversacion';
import type { PropuestaTicket, Ticket } from '../../domain/models/ticket';
import type { ChatRepository } from '../../domain/ports/chat.repository';
import type { SesionConversacionPort } from '../../domain/ports/sesion-conversacion.port';
import type { TicketRepository } from '../../domain/ports/ticket.repository';
import {
  CHAT_REPOSITORY,
  POLITICA_REPOSITORY,
  SERVICIO_REPOSITORY,
  SESION_CONVERSACION,
  TICKET_REPOSITORY,
} from '../di/tokens';
import { type AvisoError, ConversacionStore } from './conversacion.store';

/*
 * El store se prueba contra dobles de los PUERTOS, no contra la simulacion:
 * demuestra que funciona igual con cualquier implementacion.
 */

const AHORA = new Date('2026-09-12T10:00:00.000Z');

const propuesta: PropuestaTicket = {
  id: 'prop-1',
  conversacionId: 'conv-1',
  servicio: 'plataforma-virtual',
  categoria: 'Falla',
  prioridad: 'alta',
  resumen: 'No carga el aula virtual',
  descripcion: 'El solicitante reporta...',
  estado: 'pendiente',
  creadaEn: AHORA,
  resueltaEn: null,
  ticketNumero: null,
};

const ticket: Ticket = {
  numero: 'UH-2026-000042',
  propuestaId: 'prop-1',
  conversacionId: 'conv-1',
  servicio: 'plataforma-virtual',
  categoria: 'Falla',
  prioridad: 'alta',
  estado: 'asignado',
  creadoEn: AHORA,
  atencionEstimada: '4 horas',
};

function respuesta(turno: number, parcial: Partial<RespuestaMensaje> = {}): RespuestaMensaje {
  const asistente: MensajeAsistente = {
    id: `a${turno}`,
    rol: 'asistente',
    turno,
    clasificacion: { tipo: 'diagnostico', confianza: 0.9 },
    bloques: [{ tipo: 'texto', texto: 'Hay un incidente activo.' }],
    enviadoEn: AHORA,
  };
  return {
    conversacionId: 'conv-1',
    mensajeUsuario: { id: `u${turno}`, rol: 'usuario', turno, texto: 'texto', enviadoEn: AHORA },
    respuesta: asistente,
    turnos: { usados: turno, maximos: 3 },
    accionSugerida: null,
    conversacion: {
      id: 'conv-1',
      titulo: 'Falla del aula virtual',
      creadaEn: AHORA,
      actualizadaEn: new Date(AHORA.getTime() + turno * 60_000),
      turnos: { usados: turno, maximos: 3 },
    },
    ...parcial,
  };
}

function configurar() {
  const chat: jest.Mocked<ChatRepository> = {
    enviarMensaje: jest.fn(),
    obtenerHistorial: jest.fn(),
    listarConversaciones: jest.fn().mockResolvedValue([]),
    eliminarConversacion: jest.fn().mockResolvedValue(undefined),
  };
  const tickets: jest.Mocked<TicketRepository> = {
    proponerTicket: jest.fn().mockResolvedValue(propuesta),
    confirmarTicket: jest.fn().mockResolvedValue(ticket),
    rechazarTicket: jest.fn().mockResolvedValue({ ...propuesta, estado: 'rechazada' }),
  };
  const sesion: jest.Mocked<SesionConversacionPort> = {
    leerConversacionActiva: jest.fn().mockReturnValue(null),
    guardarConversacionActiva: jest.fn(),
    olvidarConversacionActiva: jest.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: CHAT_REPOSITORY, useValue: chat },
      { provide: TICKET_REPOSITORY, useValue: tickets },
      { provide: POLITICA_REPOSITORY, useValue: { buscarPolitica: jest.fn() } },
      { provide: SERVICIO_REPOSITORY, useValue: { consultarEstado: jest.fn() } },
      { provide: SESION_CONVERSACION, useValue: sesion },
    ],
  });

  return { store: TestBed.inject(ConversacionStore), chat, tickets, sesion };
}

describe('ConversacionStore', () => {
  it('un texto corto produce una peticion de aclaracion y no llama al backend (HU-FE-06)', async () => {
    const { store, chat } = configurar();

    await store.enviar('hola');

    expect(chat.enviarMensaje).not.toHaveBeenCalled();
    expect(store.entradas()).toEqual([
      expect.objectContaining({ rol: 'aclaracion', textoOriginal: 'hola' }),
    ]);
  });

  it('conserva el historial, asocia turnos y expone el conteo como signal (HU-FE-07, HU-FE-08)', async () => {
    const { store, chat, sesion } = configurar();
    chat.enviarMensaje.mockResolvedValueOnce(respuesta(1)).mockResolvedValueOnce(respuesta(2));

    const envio = store.enviar('El aula virtual no carga');
    expect(store.esperandoRespuesta()).toBe(true);
    expect(store.puedeEscribir()).toBe(false);
    await envio;
    expect(store.esperandoRespuesta()).toBe(false);

    await store.enviar('Sigue sin cargar desde el celular');

    expect(chat.enviarMensaje).toHaveBeenLastCalledWith({
      conversacionId: 'conv-1',
      texto: 'Sigue sin cargar desde el celular',
    });
    expect(store.entradas().map((e) => e.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
    expect(store.conteoTurnos()).toBe(2);
    expect(sesion.guardarConversacionActiva).toHaveBeenCalledWith('conv-1');
  });

  it('pide propuesta cuando se sugiere, pero NUNCA crea el ticket sin el boton (HU-FE-17)', async () => {
    const { store, chat, tickets } = configurar();
    chat.enviarMensaje
      .mockResolvedValueOnce(respuesta(1, { accionSugerida: 'proponer-ticket' }))
      .mockResolvedValueOnce(respuesta(2));

    await store.enviar('El aula virtual no carga');
    await store.enviar('Sí, créalo, confirmo el ticket');

    expect(tickets.proponerTicket).toHaveBeenCalledWith({ conversacionId: 'conv-1' });
    expect(tickets.confirmarTicket).not.toHaveBeenCalled();
  });

  it('confirmar crea el ticket una sola vez y marca la propuesta como resuelta (HU-FE-19)', async () => {
    const { store, chat, tickets } = configurar();
    chat.enviarMensaje.mockResolvedValueOnce(respuesta(1, { accionSugerida: 'proponer-ticket' }));
    await store.enviar('El aula virtual no carga');

    await Promise.all([store.confirmarPropuesta('prop-1'), store.confirmarPropuesta('prop-1')]);
    await store.confirmarPropuesta('prop-1');

    expect(tickets.confirmarTicket).toHaveBeenCalledTimes(1);
    expect(tickets.confirmarTicket).toHaveBeenCalledWith({
      propuestaId: 'prop-1',
      origen: 'accion-usuario',
    });

    const bloques = store.entradas().flatMap((e) => (e.rol === 'asistente' ? e.bloques : []));
    expect(bloques).toContainEqual({
      tipo: 'propuesta-ticket',
      propuesta: expect.objectContaining({ estado: 'confirmada', ticketNumero: 'UH-2026-000042' }),
    });
    expect(bloques).toContainEqual({ tipo: 'ticket-creado', ticket });
  });

  it('una propuesta rechazada no puede confirmarse (HU-FE-18)', async () => {
    const { store, chat, tickets } = configurar();
    chat.enviarMensaje.mockResolvedValueOnce(respuesta(1, { accionSugerida: 'proponer-ticket' }));
    await store.enviar('El aula virtual no carga');

    await store.rechazarPropuesta('prop-1');
    await store.confirmarPropuesta('prop-1');

    expect(tickets.rechazarTicket).toHaveBeenCalledWith('prop-1');
    expect(tickets.confirmarTicket).not.toHaveBeenCalled();
  });

  it('muestra errores tipados y permite reintentar sin duplicar el mensaje', async () => {
    const { store, chat } = configurar();
    chat.enviarMensaje
      .mockRejectedValueOnce(new ErrorBackend('servicio-no-disponible', 'No disponible'))
      .mockResolvedValueOnce(respuesta(1));

    await store.enviar('El aula virtual no carga');
    const aviso = store.entradas().find((e): e is AvisoError => e.rol === 'error');
    expect(aviso?.error).toEqual({
      codigo: 'servicio-no-disponible',
      mensaje: 'No disponible',
      reintentable: true,
    });

    await store.reintentar(aviso?.id ?? '');

    expect(store.entradas().map((e) => e.rol)).toEqual(['usuario', 'asistente']);
  });

  it('conserva los tickets de la sesion al iniciar otra conversacion', async () => {
    const { store, chat } = configurar();
    chat.enviarMensaje.mockResolvedValueOnce(respuesta(1, { accionSugerida: 'proponer-ticket' }));
    await store.enviar('El aula virtual no carga');
    await store.confirmarPropuesta('prop-1');

    store.nuevaConversacion();

    expect(store.entradas()).toEqual([]);
    expect(store.ticketsSesion()).toEqual([ticket]);
  });

  it('bloquea la escritura al alcanzar el limite de turnos (RNF-04)', async () => {
    const { store, chat } = configurar();
    chat.enviarMensaje.mockRejectedValueOnce(
      new ErrorBackend('limite-turnos', 'Límite', { turnosMaximos: 3 }),
    );

    await store.enviar('El aula virtual no carga');

    expect(store.limiteAlcanzado()).toBe(true);
    expect(store.puedeEscribir()).toBe(false);
    expect(store.entradas()).toEqual([]);
  });

  it('aplica el maximo de tres politicas a lo que llega del puerto (HU-FE-12)', async () => {
    const { store, chat } = configurar();
    const cita = (codigo: string) => ({
      codigo,
      version: '1',
      titulo: '',
      extracto: '',
      area: 'biblioteca' as const,
    });
    const base = respuesta(1);
    chat.enviarMensaje.mockResolvedValueOnce({
      ...base,
      respuesta: {
        ...base.respuesta,
        bloques: [{ tipo: 'politicas', politicas: ['A', 'B', 'C', 'D'].map(cita) }],
      },
    });

    await store.enviar('¿Cómo recupero mi contraseña?');

    const [, asistente] = store.entradas();
    const [bloque] = asistente.rol === 'asistente' ? asistente.bloques : [];
    expect(bloque.tipo === 'politicas' && bloque.politicas).toHaveLength(3);
  });

  it('recupera el historial de la sesion activa y olvida conversaciones expiradas', async () => {
    const { store, chat, sesion } = configurar();
    sesion.leerConversacionActiva.mockReturnValue('conv-1');
    const r = respuesta(2);
    chat.obtenerHistorial.mockResolvedValueOnce({
      conversacionId: 'conv-1',
      mensajes: [r.mensajeUsuario, r.respuesta],
      turnos: { usados: 2, maximos: 3 },
    });

    await store.iniciar();
    expect(store.conteoTurnos()).toBe(2);
    expect(store.entradas()).toHaveLength(2);

    chat.obtenerHistorial.mockRejectedValueOnce(new ErrorBackend('no-encontrado', 'Expiró'));
    store.nuevaConversacion();
    await store.iniciar();
    expect(sesion.olvidarConversacionActiva).toHaveBeenCalled();
    expect(store.entradas()).toEqual([]);
  });

  it('lista conversaciones, abre una del historial y elimina la activa', async () => {
    const { store, chat, sesion } = configurar();
    const resumen = (id: string, minutos: number) => ({
      id,
      titulo: `Conversación ${id}`,
      creadaEn: AHORA,
      actualizadaEn: new Date(AHORA.getTime() + minutos * 60_000),
      turnos: { usados: 1, maximos: 3 },
    });
    chat.listarConversaciones.mockResolvedValueOnce([resumen('conv-a', 1), resumen('conv-b', 5)]);

    await store.iniciar();
    expect(store.conversaciones().map((c) => c.id)).toEqual(['conv-b', 'conv-a']);

    const r = respuesta(1);
    chat.obtenerHistorial.mockResolvedValueOnce({
      conversacionId: 'conv-a',
      mensajes: [r.mensajeUsuario, r.respuesta],
      turnos: { usados: 1, maximos: 3 },
    });
    await store.abrirConversacion('conv-a');

    expect(store.conversacionId()).toBe('conv-a');
    expect(store.entradas()).toHaveLength(2);
    expect(sesion.guardarConversacionActiva).toHaveBeenCalledWith('conv-a');

    await store.eliminarConversacion('conv-a');

    expect(chat.eliminarConversacion).toHaveBeenCalledWith('conv-a');
    expect(store.conversaciones().map((c) => c.id)).toEqual(['conv-b']);
    expect(store.conversacionId()).toBeNull();
    expect(store.entradas()).toEqual([]);
  });

  it('una conversacion nueva queda primera en el historial al recibir respuesta', async () => {
    const { store, chat } = configurar();
    chat.enviarMensaje.mockResolvedValueOnce(respuesta(1));

    await store.enviar('El aula virtual no carga');

    expect(store.conversaciones()).toEqual([
      expect.objectContaining({ id: 'conv-1', titulo: 'Falla del aula virtual' }),
    ]);
  });
});

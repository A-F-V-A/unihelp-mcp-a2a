import { Test } from '@nestjs/testing';
import type { RespuestaMensajeDto } from '@unihelp/contratos';
import { TriajeService } from '../triaje/triaje.service';
import { ConversacionB3Controller } from './conversacion-b3.controller';

describe('ConversacionB3Controller (HU-01, HU-04)', () => {
  let controller: ConversacionB3Controller;
  let mockTriajeService: {
    procesarTurno: jest.Mock;
    listarConversaciones: jest.Mock;
    obtenerHistorial: jest.Mock;
    eliminarConversacion: jest.Mock;
  };

  const mockRespuesta: RespuestaMensajeDto = {
    conversacionId: 'conv-123',
    conversacion: {
      id: 'conv-123',
      titulo: 'Consulta de prueba',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      turnos: { usados: 1, maximos: 8 },
    },
    mensajeUsuario: {
      id: 'msg-u-1',
      rol: 'usuario',
      turno: 1,
      texto: 'Hola, tengo una consulta',
      enviadoEn: new Date().toISOString(),
    },
    respuesta: {
      id: 'msg-a-1',
      rol: 'asistente',
      turno: 1,
      clasificacion: { tipo: 'informativa', confianza: 0.9 },
      bloques: [{ tipo: 'texto', texto: 'Hola, ¿en qué te ayudo?' }],
      enviadoEn: new Date().toISOString(),
    },
    turnos: { usados: 1, maximos: 8 },
    accionSugerida: null,
  };

  beforeEach(async () => {
    mockTriajeService = {
      procesarTurno: jest.fn().mockResolvedValue({
        respuestaMensaje: mockRespuesta,
        tareaA2a: {},
        resultadoTriajeData: {},
      }),
      listarConversaciones: jest.fn().mockReturnValue([mockRespuesta.conversacion]),
      obtenerHistorial: jest.fn().mockReturnValue({
        conversacionId: 'conv-123',
        mensajes: [mockRespuesta.mensajeUsuario, mockRespuesta.respuesta],
        turnos: { usados: 1, maximos: 8 },
      }),
      eliminarConversacion: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ConversacionB3Controller],
      providers: [
        {
          provide: TriajeService,
          useValue: mockTriajeService,
        },
      ],
    }).compile();

    controller = moduleRef.get<ConversacionB3Controller>(ConversacionB3Controller);
  });

  it('debe recibir mensaje en POST /api/conversaciones/mensajes y devolver RespuestaMensajeDto', async () => {
    const res = await controller.enviarMensaje({
      conversacionId: 'conv-123',
      texto: 'Hola, tengo una consulta',
    });

    expect(res.conversacionId).toBe('conv-123');
    expect(res.respuesta.bloques).toHaveLength(1);
    expect(mockTriajeService.procesarTurno).toHaveBeenCalledTimes(1);
  });

  it('debe listar conversaciones', () => {
    const lista = controller.listarConversaciones();
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe('conv-123');
  });

  it('debe obtener historial de la conversacion', () => {
    const historial = controller.obtenerHistorial('conv-123');
    expect(historial.conversacionId).toBe('conv-123');
    expect(historial.mensajes).toHaveLength(2);
  });
});

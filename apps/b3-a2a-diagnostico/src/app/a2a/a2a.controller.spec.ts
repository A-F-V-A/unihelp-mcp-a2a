import { Test } from '@nestjs/testing';
import type { ArtefactoDiagnosticoDataDto } from '@unihelp/contratos';
import { CapacidadesMcpDiagnostico } from '../capacidades-mcp/capacidades-mcp-diagnostico';
import { A2aController } from './a2a.controller';
import { IncidentDiagnosisService } from './incident-diagnosis.service';

describe('A2aController (b3-a2a-diagnostico, HU-29, HU-30)', () => {
  let controller: A2aController;

  const mockDiagnosticoData: ArtefactoDiagnosticoDataDto = {
    servicio: 'aula_virtual',
    estado: 'DEGRADADO',
    alcance: 'parcial',
    componentes_afectados: ['subida_archivos'],
    sintomas_correlacionados: ['El aula virtual va lenta al subir archivos'],
    prioridad_sugerida: 'P3',
    justificacion_prioridad: 'DEGRADADO + alcance parcial ⇒ P3 según tabla institucional',
    accion_recomendada: 'crear_ticket',
    incidente_ref: 'INC-2026-0042',
  };

  const mockCapacidadesMcp = {
    consultarEstadoServicio: jest.fn().mockResolvedValue({
      estado: {
        servicio: 'aula_virtual',
        estado: 'DEGRADADO',
        alcance: 'parcial',
        componentes_afectados: ['subida_archivos'],
        incidente_ref: 'INC-2026-0042',
      },
      durMs: 12,
      rttMs: 20,
    }),
  };

  beforeEach(async () => {
    mockCapacidadesMcp.consultarEstadoServicio.mockClear();

    const moduleRef = await Test.createTestingModule({
      controllers: [A2aController],
      providers: [
        IncidentDiagnosisService,
        {
          provide: CapacidadesMcpDiagnostico,
          useValue: mockCapacidadesMcp,
        },
      ],
    }).compile();

    controller = moduleRef.get<A2aController>(A2aController);
  });

  it('debe atender message/send y retornar el artefacto diagnostico (HU-30)', async () => {
    const respuesta = await controller.atenderMensaje({
      jsonrpc: '2.0',
      id: 'req-diag-001',
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: 'El aula virtual va lenta al subir archivos' }],
          metadata: {
            traceId: 'trace-diag-123',
            hop: 1,
            emisor: 'b3-a2a-orquestador',
            receptor: 'b3-a2a-diagnostico',
            t_emision: new Date().toISOString(),
          },
        },
      },
    });

    expect(respuesta.jsonrpc).toBe('2.0');
    expect(respuesta.id).toBe('req-diag-001');
    expect(respuesta.result?.status).toBe('completed');
    expect(respuesta.result?.artifacts).toHaveLength(1);

    const artefacto = respuesta.result?.artifacts[0];
    expect(artefacto?.artifactId).toBe('diagnostico');
    expect(artefacto?.parts[0]).toMatchObject({
      kind: 'data',
      data: mockDiagnosticoData,
    });

    const mensajeRespuesta = respuesta.result?.messages[0];
    expect(mensajeRespuesta?.metadata?.hop).toBe(2);
    expect(mensajeRespuesta?.metadata?.traceId).toBe('trace-diag-123');
    expect(mensajeRespuesta?.metadata?.emisor).toBe('b3-a2a-diagnostico');
  });

  it('debe rechazar métodos JSON-RPC distintos de message/send con código -32601', async () => {
    const respuesta = await controller.atenderMensaje({
      jsonrpc: '2.0',
      id: 'req-diag-002',
      method: 'metodo/invalido',
    });

    expect(respuesta.error).toBeDefined();
    expect(respuesta.error?.code).toBe(-32601);
  });

  it('debe retornar status failed cuando la consulta de síntomas esta vacía', async () => {
    const respuesta = await controller.atenderMensaje({
      jsonrpc: '2.0',
      id: 'req-diag-003',
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: '   ' }],
        },
      },
    });

    expect(respuesta.result?.status).toBe('failed');
    expect(respuesta.result?.artifacts).toHaveLength(0);
  });

  it('debe capturar fallos de infraestructura sin lanzar excepciones (HU-32, RM-15)', async () => {
    mockCapacidadesMcp.consultarEstadoServicio.mockRejectedValueOnce(
      new Error('Servidor MCP no disponible'),
    );

    const respuesta = await controller.atenderMensaje({
      jsonrpc: '2.0',
      id: 'req-diag-004',
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: 'correo bloqueado' }],
        },
      },
    });

    expect(respuesta.result?.status).toBe('failed');
    expect(respuesta.result?.messages[0].parts[0]).toMatchObject({
      kind: 'text',
      text: expect.stringContaining('Fallo de infraestructura'),
    });
  });
});

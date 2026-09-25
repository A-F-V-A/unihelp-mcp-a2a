import { Test } from '@nestjs/testing';
import type { ArtefactoPoliticaAplicableDataDto } from '@unihelp/contratos';
import { CapacidadesMcpConocimiento } from '../capacidades-mcp/capacidades-mcp-conocimiento';
import { A2aController } from './a2a.controller';
import { KnowledgeLookupService } from './knowledge-lookup.service';

describe('A2aController (b3-a2a-conocimiento, HU-29, HU-30)', () => {
  let controller: A2aController;

  const mockArtefactoData: ArtefactoPoliticaAplicableDataDto = {
    politicas: [
      {
        codigo: 'POL-AV-001',
        titulo: 'Política de Entrega Tardía',
        version: '1.0',
        extracto: 'El plazo máximo de prórroga es de 48 horas.',
        relevancia: 0.92,
      },
    ],
    resumen: 'Se identificaron 1 política(s) aplicables, principalmente POL-AV-001.',
    confianza: 'alta',
    sin_resultados: false,
  };

  const mockCapacidadesMcp = {
    buscarPolitica: jest.fn().mockResolvedValue({
      artefacto: mockArtefactoData,
      durMs: 15,
      rttMs: 25,
    }),
  };

  beforeEach(async () => {
    mockCapacidadesMcp.buscarPolitica.mockClear();

    const moduleRef = await Test.createTestingModule({
      controllers: [A2aController],
      providers: [
        KnowledgeLookupService,
        {
          provide: CapacidadesMcpConocimiento,
          useValue: mockCapacidadesMcp,
        },
      ],
    }).compile();

    controller = moduleRef.get<A2aController>(A2aController);
  });

  it('debe atender message/send y retornar el artefacto politica_aplicable (HU-30)', async () => {
    const respuesta = await controller.atenderMensaje({
      jsonrpc: '2.0',
      id: 'req-001',
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: '¿Cuál es el plazo para solicitar prórroga?' }],
          metadata: {
            traceId: 'trace-test-123',
            hop: 1,
            emisor: 'b3-a2a-orquestador',
            receptor: 'b3-a2a-conocimiento',
            t_emision: new Date().toISOString(),
          },
        },
      },
    });

    expect(respuesta.jsonrpc).toBe('2.0');
    expect(respuesta.id).toBe('req-001');
    expect(respuesta.result?.status).toBe('completed');
    expect(respuesta.result?.artifacts).toHaveLength(1);

    const artefacto = respuesta.result?.artifacts[0];
    expect(artefacto?.artifactId).toBe('politica_aplicable');
    expect(artefacto?.parts[0]).toMatchObject({
      kind: 'data',
      data: mockArtefactoData,
    });

    const mensajeRespuesta = respuesta.result?.messages[0];
    expect(mensajeRespuesta?.metadata?.hop).toBe(2);
    expect(mensajeRespuesta?.metadata?.traceId).toBe('trace-test-123');
    expect(mensajeRespuesta?.metadata?.emisor).toBe('b3-a2a-conocimiento');
  });

  it('debe rechazar métodos JSON-RPC distintos de message/send con código -32601', async () => {
    const respuesta = await controller.atenderMensaje({
      jsonrpc: '2.0',
      id: 'req-002',
      method: 'metodo/invalido',
    });

    expect(respuesta.error).toBeDefined();
    expect(respuesta.error?.code).toBe(-32601);
  });

  it('debe retornar status failed cuando la consulta de texto esta vacía', async () => {
    const respuesta = await controller.atenderMensaje({
      jsonrpc: '2.0',
      id: 'req-003',
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
    mockCapacidadesMcp.buscarPolitica.mockRejectedValueOnce(
      new Error('Conexión rechazada al servidor MCP'),
    );

    const respuesta = await controller.atenderMensaje({
      jsonrpc: '2.0',
      id: 'req-004',
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: 'consulta cualquiera' }],
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

import type { AgentCardDto } from '@unihelp/contratos';
import { ClienteA2aService } from '../a2a-cliente/cliente-a2a.service';
import { CapacidadesMcpOrquestador } from '../capacidades-mcp/capacidades-mcp-orquestador';
import { ClasificadorService } from '../clasificador/clasificador.service';
import { RegistroA2aService } from '../registro-a2a/registro-a2a.service';
import { RepositorioTareasService } from '../tareas/repositorio-tareas.service';
import { TriajeService } from './triaje.service';

describe('Concurrencia de tareas A2A en B3 (HU-32)', () => {
  let service: TriajeService;
  let mockClienteA2a: { enviarMensaje: jest.Mock };
  let mockCapacidadesMcp: {
    proponerTicket: jest.Mock;
    confirmarPropuesta: jest.Mock;
    crearTicketSimulado: jest.Mock;
  };

  const cardConocimiento: AgentCardDto = {
    protocolVersion: '1.0',
    name: 'Knowledge Agent',
    description: '',
    url: 'http://localhost:3004/a2a',
    preferredTransport: 'JSONRPC',
    version: '1.0.0',
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'knowledge_lookup',
        name: 'Lookup',
        description: '',
        tags: [],
        examples: [],
      },
    ],
  };

  beforeEach(() => {
    const clasificador = new ClasificadorService();
    const registroA2a = new RegistroA2aService();
    registroA2a.registrarAgente(cardConocimiento);

    mockClienteA2a = {
      enviarMensaje: jest.fn().mockImplementation((_card, texto: string) => {
        return Promise.resolve({
          task: {
            id: `task-esp-${Math.random()}`,
            status: 'completed',
            messages: [],
            artifacts: [
              {
                artifactId: 'politica_aplicable',
                parts: [
                  {
                    kind: 'data',
                    data: {
                      politicas: [],
                      resumen: `Resumen para consulta: ${texto.slice(0, 15)}`,
                      confianza: 'alta',
                      sin_resultados: false,
                    },
                  },
                ],
              },
            ],
          },
          rttMs: 5,
        });
      }),
    };

    mockCapacidadesMcp = {
      proponerTicket: jest.fn(),
      confirmarPropuesta: jest.fn(),
      crearTicketSimulado: jest.fn(),
    };

    const repositorioTareas = new RepositorioTareasService();

    service = new TriajeService(
      clasificador,
      registroA2a,
      mockClienteA2a as unknown as ClienteA2aService,
      mockCapacidadesMcp as unknown as CapacidadesMcpOrquestador,
      repositorioTareas,
    );
  });

  it('10 tareas concurrentes no mezclan identificadores de tarea ni de conversación (HU-32)', async () => {
    const cantidad = 10;
    const promesas = Array.from({ length: cantidad }, (_, i) => {
      const convId = `conv-concurrente-${i}`;
      const texto = `¿Cuál es la política institucional ${i}?`;
      return service.procesarTurno(convId, texto);
    });

    const resultados = await Promise.all(promesas);

    expect(resultados).toHaveLength(cantidad);

    const taskIds = new Set<string>();
    const convIds = new Set<string>();

    for (let i = 0; i < cantidad; i++) {
      const res = resultados[i];
      expect(res.respuestaMensaje.conversacionId).toBe(`conv-concurrente-${i}`);
      taskIds.add(res.tareaA2a.id);
      convIds.add(res.respuestaMensaje.conversacionId);
    }

    // Ningún taskId repetido ni mezclado
    expect(taskIds.size).toBe(cantidad);
    expect(convIds.size).toBe(cantidad);
  });
});

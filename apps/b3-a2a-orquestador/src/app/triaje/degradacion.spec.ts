import type { AgentCardDto } from '@unihelp/contratos';
import { ClienteA2aService } from '../a2a-cliente/cliente-a2a.service';
import { CapacidadesMcpOrquestador } from '../capacidades-mcp/capacidades-mcp-orquestador';
import { ClasificadorService } from '../clasificador/clasificador.service';
import { RegistroA2aService } from '../registro-a2a/registro-a2a.service';
import { RepositorioTareasService } from '../tareas/repositorio-tareas.service';
import { TriajeService } from './triaje.service';

describe('Degradación elegante en B3 (HU-32, RM-15)', () => {
  let service: TriajeService;
  let mockClienteA2a: { enviarMensaje: jest.Mock };
  let mockCapacidadesMcp: {
    proponerTicket: jest.Mock;
    confirmarPropuesta: jest.Mock;
    crearTicketSimulado: jest.Mock;
  };

  const cardDiagnostico: AgentCardDto = {
    protocolVersion: '1.0',
    name: 'Diagnosis Agent',
    description: '',
    url: 'http://localhost:3005/a2a',
    preferredTransport: 'JSONRPC',
    version: '1.0.0',
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'incident_diagnosis',
        name: 'Diagnosis',
        description: '',
        tags: [],
        examples: [],
      },
    ],
  };

  beforeEach(() => {
    const clasificador = new ClasificadorService();
    const registroA2a = new RegistroA2aService();
    registroA2a.registrarAgente(cardDiagnostico);

    mockClienteA2a = {
      enviarMensaje: jest.fn(),
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

  it('con diagnosis-agent caído, el orquestador retorna failed con motivo y sin inventar diagnóstico ni proponer ticket (HU-32)', async () => {
    // Especialista caído o inalcanzable retorna null
    mockClienteA2a.enviarMensaje.mockResolvedValueOnce(null);

    const resultado = await service.procesarTurno(
      'conv-deg-1',
      'El aula virtual tiene un error 500 y no carga',
    );

    // Debe terminar en estado failed según HU-32
    expect(resultado.tareaA2a.status).toBe('failed');
    // No debe contener artefacto de diagnóstico inventado
    expect(resultado.resultadoTriajeData.diagnostico).toBeNull();
    // No debe crear ni proponer ticket
    expect(resultado.resultadoTriajeData.ticket.creado).toBe(false);
    expect(resultado.resultadoTriajeData.confirmacion.solicitada).toBe(false);
    expect(mockCapacidadesMcp.proponerTicket).not.toHaveBeenCalled();
    // La respuesta en texto debe indicar honestamente que no se pudo diagnosticar
    const parteTexto = resultado.respuestaMensaje.respuesta.bloques.find((b) => b.tipo === 'texto');
    expect(parteTexto && 'texto' in parteTexto ? parteTexto.texto : '').toContain(
      'especialista no disponible',
    );
  });
});

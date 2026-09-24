import type { AgentCardDto } from '@unihelp/contratos';
import { ClienteA2aService } from '../a2a-cliente/cliente-a2a.service';
import { CapacidadesMcpOrquestador } from '../capacidades-mcp/capacidades-mcp-orquestador';
import { ClasificadorService } from '../clasificador/clasificador.service';
import { RegistroA2aService } from '../registro-a2a/registro-a2a.service';
import { RepositorioTareasService } from '../tareas/repositorio-tareas.service';
import { TriajeService } from './triaje.service';

describe('TriajeService (HU-01 a HU-17, HU-29 a HU-34)', () => {
  let service: TriajeService;
  let clasificador: ClasificadorService;
  let registroA2a: RegistroA2aService;
  let mockClienteA2a: { enviarMensaje: jest.Mock };
  let mockCapacidadesMcp: {
    proponerTicket: jest.Mock;
    confirmarPropuesta: jest.Mock;
    crearTicketSimulado: jest.Mock;
  };
  let repositorioTareas: RepositorioTareasService;

  const cardConocimiento: AgentCardDto = {
    protocolVersion: '1.0',
    name: 'Knowledge Agent',
    description: '',
    url: 'http://localhost:3004/a2a',
    preferredTransport: 'JSONRPC',
    version: '1.0.0',
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
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

  const cardDiagnostico: AgentCardDto = {
    protocolVersion: '1.0',
    name: 'Diagnosis Agent',
    description: '',
    url: 'http://localhost:3005/a2a',
    preferredTransport: 'JSONRPC',
    version: '1.0.0',
    capabilities: { streaming: true, pushNotifications: false, stateTransitionHistory: true },
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
    clasificador = new ClasificadorService();
    registroA2a = new RegistroA2aService();
    registroA2a.registrarAgente(cardConocimiento);
    registroA2a.registrarAgente(cardDiagnostico);

    mockClienteA2a = {
      enviarMensaje: jest.fn(),
    };

    mockCapacidadesMcp = {
      proponerTicket: jest.fn(),
      confirmarPropuesta: jest.fn(),
      crearTicketSimulado: jest.fn(),
    };

    repositorioTareas = new RepositorioTareasService();

    service = new TriajeService(
      clasificador,
      registroA2a,
      mockClienteA2a as unknown as ClienteA2aService,
      mockCapacidadesMcp as unknown as CapacidadesMcpOrquestador,
      repositorioTareas,
    );
  });

  it('debe atender solicitud informativa consultando knowledge-agent (HU-05, HU-30)', async () => {
    mockClienteA2a.enviarMensaje.mockResolvedValueOnce({
      task: {
        id: 'task-know-1',
        status: 'completed',
        messages: [],
        artifacts: [
          {
            artifactId: 'politica_aplicable',
            parts: [
              {
                kind: 'data',
                data: {
                  politicas: [
                    {
                      codigo: 'POL-001',
                      titulo: 'Reactivación correo',
                      version: '1.0',
                      extracto: 'Plazo de 15 días hábiles.',
                      relevancia: 0.95,
                    },
                  ],
                  resumen: 'El plazo para reactivación es de 15 días.',
                  confianza: 'alta',
                  sin_resultados: false,
                },
              },
            ],
          },
        ],
      },
      rttMs: 25,
    });

    const resultado = await service.procesarTurno(
      'conv-test-1',
      '¿Cuál es el plazo para la política de reactivación de correo?',
    );

    expect(resultado.tareaA2a.status).toBe('completed');
    expect(resultado.resultadoTriajeData.politicas_citadas).toContain('POL-001');
    expect(resultado.resultadoTriajeData.ticket.creado).toBe(false);
    expect(mockClienteA2a.enviarMensaje).toHaveBeenCalledTimes(1);
  });

  it('debe pausar en input-required al detectar falla y proponer ticket (HU-13, HU-14, HU-31)', async () => {
    mockClienteA2a.enviarMensaje.mockResolvedValueOnce({
      task: {
        id: 'task-diag-1',
        status: 'completed',
        messages: [],
        artifacts: [
          {
            artifactId: 'diagnostico',
            parts: [
              {
                kind: 'data',
                data: {
                  servicio: 'aula_virtual',
                  estado: 'DEGRADADO',
                  alcance: 'parcial',
                  prioridad_sugerida: 'P3',
                  justificacion_prioridad: 'DEGRADADO + parcial ⇒ P3',
                  accion_recomendada: 'crear_ticket',
                  incidente_ref: 'INC-001',
                },
              },
            ],
          },
        ],
      },
      rttMs: 20,
    });

    mockCapacidadesMcp.proponerTicket.mockResolvedValueOnce({
      propuesta: {
        proposal_id: 'PROP-12345',
        resumen: 'Incidente en aula_virtual',
        descripcion: 'Falla al subir tareas',
        servicio: 'aula_virtual',
        categoria: 'rendimiento',
        prioridad: 'P3',
        expira_en: '2026-09-24T23:00:00Z',
      },
      durMs: 10,
      rttMs: 15,
    });

    const resultado = await service.procesarTurno(
      'conv-test-2',
      'El aula virtual va muy lenta y da error al subir archivos',
    );

    expect(resultado.tareaA2a.status).toBe('input-required');
    expect(resultado.respuestaMensaje.accionSugerida).toBe('proponer-ticket');
    expect(resultado.resultadoTriajeData.confirmacion.solicitada).toBe(true);
    expect(resultado.resultadoTriajeData.confirmacion.otorgada).toBe(false);
    expect(mockCapacidadesMcp.proponerTicket).toHaveBeenCalledTimes(1);

    // Segundo turno: el usuario confirma explícitamente
    mockCapacidadesMcp.confirmarPropuesta.mockResolvedValueOnce({
      confirmacion: {
        confirmacion_token: 'tok-valid-789',
        aceptada: true,
        motivo_rechazo: null,
      },
      durMs: 8,
      rttMs: 12,
    });

    mockCapacidadesMcp.crearTicketSimulado.mockResolvedValueOnce({
      ticket: {
        ticket_id: 'UNI-2026-000101',
        estado: 'creado',
        creado_en: new Date().toISOString(),
        creado: true,
        motivo: null,
      },
      durMs: 10,
      rttMs: 14,
    });

    const resultadoConfirmado = await service.procesarTurno(
      'conv-test-2',
      'Sí, confirmo la creación del ticket por favor',
    );

    expect(resultadoConfirmado.tareaA2a.status).toBe('completed');
    expect(resultadoConfirmado.resultadoTriajeData.ticket.creado).toBe(true);
    expect(resultadoConfirmado.resultadoTriajeData.ticket.id).toBe('UNI-2026-000101');
    expect(resultadoConfirmado.resultadoTriajeData.confirmacion.otorgada).toBe(true);
    expect(mockCapacidadesMcp.crearTicketSimulado).toHaveBeenCalledTimes(1);
  });

  it('debe respetar la negativa del usuario sin crear ticket (HU-15)', async () => {
    mockClienteA2a.enviarMensaje.mockResolvedValueOnce({
      task: {
        id: 'task-diag-2',
        status: 'completed',
        messages: [],
        artifacts: [
          {
            artifactId: 'diagnostico',
            parts: [
              {
                kind: 'data',
                data: {
                  servicio: 'aula_virtual',
                  estado: 'DEGRADADO',
                  alcance: 'parcial',
                  prioridad_sugerida: 'P3',
                  justificacion_prioridad: 'DEGRADADO ⇒ P3',
                  accion_recomendada: 'crear_ticket',
                },
              },
            ],
          },
        ],
      },
      rttMs: 15,
    });

    mockCapacidadesMcp.proponerTicket.mockResolvedValueOnce({
      propuesta: {
        proposal_id: 'PROP-999',
        resumen: 'Incidente aula virtual',
        descripcion: 'Problema de carga',
        servicio: 'aula_virtual',
        categoria: 'rendimiento',
        prioridad: 'P3',
        expira_en: '2026-09-24T23:00:00Z',
      },
      durMs: 5,
      rttMs: 8,
    });

    await service.procesarTurno('conv-test-3', 'El aula virtual tiene fallos');

    mockCapacidadesMcp.confirmarPropuesta.mockResolvedValueOnce({
      confirmacion: {
        confirmacion_token: null,
        aceptada: false,
        motivo_rechazo: 'Usuario canceló',
      },
      durMs: 5,
      rttMs: 7,
    });

    const resultadoCancelado = await service.procesarTurno(
      'conv-test-3',
      'No, prefiero esperar, no crees nada',
    );

    expect(resultadoCancelado.tareaA2a.status).toBe('completed');
    expect(resultadoCancelado.resultadoTriajeData.ticket.creado).toBe(false);
    expect(mockCapacidadesMcp.crearTicketSimulado).not.toHaveBeenCalled();
  });

  it('en mantenimiento programado debe informar_y_esperar y NO proponer ticket (HU-12)', async () => {
    mockClienteA2a.enviarMensaje.mockResolvedValueOnce({
      task: {
        id: 'task-diag-maint',
        status: 'completed',
        messages: [],
        artifacts: [
          {
            artifactId: 'diagnostico',
            parts: [
              {
                kind: 'data',
                data: {
                  servicio: 'matricula',
                  estado: 'MANTENIMIENTO',
                  alcance: 'programado',
                  prioridad_sugerida: 'P4',
                  justificacion_prioridad: 'Mantenimiento programado: ventana activa',
                  accion_recomendada: 'informar_y_esperar',
                },
              },
            ],
          },
        ],
      },
      rttMs: 15,
    });

    const resultado = await service.procesarTurno(
      'conv-test-4',
      'No puedo matricular asignaturas por mantenimiento',
    );

    expect(resultado.tareaA2a.status).toBe('completed');
    expect(mockCapacidadesMcp.proponerTicket).not.toHaveBeenCalled();
    expect(
      resultado.respuestaMensaje.respuesta.bloques.some((b) => b.tipo === 'aviso-mantenimiento'),
    ).toBe(true);
  });
});

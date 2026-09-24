import type { AgentCardDto } from '@unihelp/contratos';
import { expandirVariablesEntorno, RegistroA2aService } from './registro-a2a.service';

describe('RegistroA2aService (HU-29)', () => {
  let service: RegistroA2aService;

  const cardConocimiento: AgentCardDto = {
    protocolVersion: '1.0',
    name: 'UniHelp Knowledge Agent',
    description: 'Recupera y resume politicas',
    url: 'http://localhost:3004/a2a',
    preferredTransport: 'JSONRPC',
    version: '1.0.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'knowledge_lookup',
        name: 'Consulta de política institucional',
        description: 'Identifica la politica aplicable',
        tags: ['politicas'],
        examples: ['pregunta de prueba'],
      },
    ],
  };

  const cardDiagnostico: AgentCardDto = {
    protocolVersion: '1.0',
    name: 'UniHelp Diagnosis Agent',
    description: 'Diagnostica incidentes de servicio',
    url: 'http://localhost:3005/a2a',
    preferredTransport: 'JSONRPC',
    version: '1.0.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'incident_diagnosis',
        name: 'Diagnóstico de incidente',
        description: 'Relaciona sintomas con servicios',
        tags: ['diagnostico'],
        examples: ['sintoma de prueba'],
      },
    ],
  };

  beforeEach(() => {
    service = new RegistroA2aService();
  });

  describe('expandirVariablesEntorno', () => {
    it('debe expandir valores por defecto cuando la variable no existe', () => {
      delete process.env['TEST_VAR_INEXISTENTE'];
      const res = expandirVariablesEntorno('${TEST_VAR_INEXISTENTE:-http://localhost:9999}');
      expect(res).toBe('http://localhost:9999');
    });

    it('debe expandir el valor de la variable de entorno cuando existe', () => {
      process.env['TEST_VAR_EXISTENTE'] = 'http://servidor-real:8000';
      const res = expandirVariablesEntorno('${TEST_VAR_EXISTENTE:-http://localhost:9999}');
      expect(res).toBe('http://servidor-real:8000');
      delete process.env['TEST_VAR_EXISTENTE'];
    });
  });

  describe('descubrimiento y resolucion de habilidades', () => {
    it('debe descubrir especialistas y resolverlos por skills[].id (HU-29)', async () => {
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('3004')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(cardConocimiento),
          });
        }
        if (url.includes('3005')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(cardDiagnostico),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });
      });

      global.fetch = mockFetch;

      const yaml = `
agentes:
  - url: "http://localhost:3004"
  - url: "http://localhost:3005"
`;

      await service.cargarRegistro(yaml);

      const resolvedConocimiento = service.resolverAgentePorHabilidad('knowledge_lookup');
      expect(resolvedConocimiento).toBeDefined();
      expect(resolvedConocimiento?.name).toBe('UniHelp Knowledge Agent');
      expect(resolvedConocimiento?.url).toBe('http://localhost:3004/a2a');

      const resolvedDiagnostico = service.resolverAgentePorHabilidad('incident_diagnosis');
      expect(resolvedDiagnostico).toBeDefined();
      expect(resolvedDiagnostico?.name).toBe('UniHelp Diagnosis Agent');
      expect(resolvedDiagnostico?.url).toBe('http://localhost:3005/a2a');

      const resolvedInexistente = service.resolverAgentePorHabilidad('habilidad_inexistente');
      expect(resolvedInexistente).toBeUndefined();

      expect(service.listarAgentes()).toHaveLength(2);
    });

    it('no debe fallar de forma catastrofica si un especialista no responde (degradacion elegante)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const yaml = `
agentes:
  - url: "http://localhost:9999"
`;

      await expect(service.cargarRegistro(yaml)).resolves.not.toThrow();
      expect(service.listarAgentes()).toHaveLength(0);
      expect(service.resolverAgentePorHabilidad('knowledge_lookup')).toBeUndefined();
    });
  });
});

import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CABECERA_AGENT_ID } from '@unihelp/contratos';
import { CapacidadesMcpDiagnostico } from './capacidades-mcp-diagnostico';

describe('CapacidadesMcpDiagnostico (HU-20, HU-25, HU-33)', () => {
  let servidor: Server;
  let transportes: [InMemoryTransport, InMemoryTransport];
  let llamadasHeaders: Record<string, string | string[] | undefined>[];
  const fetchOriginal = global.fetch;

  beforeEach(async () => {
    llamadasHeaders = [];
    servidor = new Server(
      { name: 'mcp-server-test', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );

    servidor.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'consultar_estado_servicio',
          description: 'Consulta estado de servicios',
          inputSchema: { type: 'object' },
        },
      ],
    }));

    servidor.setRequestHandler(CallToolRequestSchema, async (peticion) => {
      if (peticion.params.name === 'consultar_estado_servicio') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                servicio: 'aula_virtual',
                nombre: 'Aula Virtual',
                estado: 'DEGRADADO',
                desde: '2026-09-24T10:00:00Z',
                componentes_afectados: ['subida_archivos'],
                alcance: 'parcial',
                nivel_sla: 'alto',
                mensaje: 'Lentitud temporal',
                eta_restablecimiento: null,
                ventana_estimada: null,
                incidente_ref: 'INC-2026-0042',
              }),
            },
          ],
        };
      }
      return { isError: true, content: [{ type: 'text', text: 'No encontrada' }] };
    });

    transportes = InMemoryTransport.createLinkedPair();
    await servidor.connect(transportes[0]);
  });

  afterEach(async () => {
    global.fetch = fetchOriginal;
    await servidor.close();
  });

  it('debe enviar la cabecera X-Agent-Id: diagnostico en peticiones HTTP', async () => {
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      llamadasHeaders.push(init?.headers as Record<string, string | string[] | undefined>);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        headers: new Headers(),
      });
    });

    const clienteMcp = new CapacidadesMcpDiagnostico(
      { urlServidorMcp: 'http://localhost:3010' },
      (fetchConTraza) => {
        void fetchConTraza('http://localhost:3010/mcp', {
          headers: {},
        });
        return transportes[1];
      },
    );

    const resultado = await clienteMcp.consultarEstadoServicio('aula_virtual', 'trace-diag-456');

    expect(resultado.estado.servicio).toBe('aula_virtual');
    expect(resultado.estado.estado).toBe('DEGRADADO');
    expect(resultado.estado.alcance).toBe('parcial');

    expect(llamadasHeaders.length).toBeGreaterThan(0);
    expect(llamadasHeaders[0][CABECERA_AGENT_ID]).toBe('diagnostico');
  });
});

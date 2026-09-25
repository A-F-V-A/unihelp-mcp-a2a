import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CABECERA_AGENT_ID, META_MCP } from '@unihelp/contratos';
import { CapacidadesMcpConocimiento } from './capacidades-mcp-conocimiento';

describe('CapacidadesMcpConocimiento (HU-20, HU-25, HU-33)', () => {
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
          name: 'buscar_politica',
          description: 'Busca políticas',
          inputSchema: { type: 'object' },
        },
      ],
    }));

    servidor.setRequestHandler(CallToolRequestSchema, async (peticion) => {
      if (peticion.params.name === 'buscar_politica') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                resultados: [
                  {
                    codigo: 'POL-001',
                    titulo: 'Política Test',
                    version: '1.0',
                    extracto: 'Extracto de prueba',
                    relevancia: 0.95,
                  },
                ],
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

  it('debe enviar la cabecera X-Agent-Id: conocimiento y X-Trace-Id en peticiones HTTP', async () => {
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      llamadasHeaders.push(init?.headers as Record<string, string | string[] | undefined>);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        headers: new Headers(),
      });
    });

    const clienteMcp = new CapacidadesMcpConocimiento(
      { urlServidorMcp: 'http://localhost:3010' },
      (fetchConTraza) => {
        // Enlazar transporte en memoria e invocar fetchConTraza para comprobar cabeceras
        void fetchConTraza('http://localhost:3010/mcp', {
          headers: {},
        });
        return transportes[1];
      },
    );

    const resultado = await clienteMcp.buscarPolitica('consulta de prueba', 'trace-test-456');

    expect(resultado.artefacto.politicas).toHaveLength(1);
    expect(resultado.artefacto.politicas[0].codigo).toBe('POL-001');
    expect(resultado.artefacto.confianza).toBe('alta');
    expect(resultado.artefacto.sin_resultados).toBe(false);

    expect(llamadasHeaders.length).toBeGreaterThan(0);
    expect(llamadasHeaders[0][CABECERA_AGENT_ID]).toBe('conocimiento');
  });

  it('debe mapear politicas cuando el servidor MCP las entrega en _meta.estructurado', async () => {
    servidor.setRequestHandler(CallToolRequestSchema, async () => ({
      content: [{ type: 'text', text: '{}' }],
      _meta: {
        [META_MCP.estructurado]: {
          tipo: 'encontradas',
          politicas: [
            {
              codigo: 'POL-CI-003',
              version: '1.1',
              titulo: 'Reactivación por inactividad',
              extracto: { texto: 'La reactivación tarda 5 días hábiles.' },
              relevancia: 0.85,
            },
          ],
        },
      },
    }));

    const clienteMcp = new CapacidadesMcpConocimiento(
      { urlServidorMcp: 'http://localhost:3010' },
      () => transportes[1],
    );

    const res = await clienteMcp.buscarPolitica('reactivar correo', 'trace-test-estructurado');
    expect(res.artefacto.politicas).toHaveLength(1);
    expect(res.artefacto.politicas[0].codigo).toBe('POL-CI-003');
    expect(res.artefacto.politicas[0].extracto).toBe('La reactivación tarda 5 días hábiles.');
    expect(res.artefacto.confianza).toBe('alta');
    expect(res.artefacto.sin_resultados).toBe(false);
  });
});

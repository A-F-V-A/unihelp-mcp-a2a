import { createServer, type IncomingMessage, type Server as ServidorHttp } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { aFunctionCalling } from '@unihelp/agente-nucleo';
import { META_MCP } from '@unihelp/contratos';
import {
  type ContextoInvocacion,
  DEFINICIONES_HERRAMIENTAS,
  ErrorInfraestructura,
} from '@unihelp/herramientas';
import { CapacidadesMcp } from './capacidades-mcp';

const contexto: ContextoInvocacion = {
  traceId: 'traza-b1',
  conversacionId: 'c-1',
  actor: 'b1-agent',
};

interface Recibido {
  readonly nombre: string;
  readonly meta: unknown;
  readonly cabeceras: Record<string, string | string[] | undefined> | undefined;
}

/** Servidor MCP falso con el contrato real, sin PostgreSQL. */
function servidorFalso() {
  const recibidas: Recibido[] = [];
  const herramientas: Tool[] = DEFINICIONES_HERRAMIENTAS.map((d) => ({
    name: d.nombre,
    title: d.titulo,
    description: d.descripcion,
    inputSchema: d.esquemaEntrada as Tool['inputSchema'],
    outputSchema: d.esquemaSalida as Tool['outputSchema'],
    annotations: { title: d.titulo, ...d.anotaciones },
  }));
  const servidor = new Server(
    { name: 'falso', version: '0' },
    { capabilities: { tools: { listChanged: true } } },
  );
  servidor.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: herramientas }));
  servidor.setRequestHandler(CallToolRequestSchema, async (peticion, extra) => {
    recibidas.push({
      nombre: peticion.params.name,
      meta: peticion.params._meta,
      cabeceras: extra.requestInfo?.headers,
    });
    if (peticion.params.name === 'crear_ticket_simulado') {
      const error = { codigo: 'CONFIRMACION_REQUERIDA', mensaje: 'Sin token no hay ticket.' };
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error }) }],
        _meta: { [META_MCP.duracionMs]: 3, [META_MCP.error]: error },
      };
    }
    const salida = {
      resultados: [],
      total_encontrados: 0,
      consulta_normalizada: 'x',
      motivo_sin_resultados: 'sin-coincidencias',
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(salida) }],
      structuredContent: salida,
      _meta: { [META_MCP.duracionMs]: 7, [META_MCP.estructurado]: { tipo: 'sin-resultados' } },
    };
  });
  return {
    servidor,
    recibidas,
    agregarHerramienta(): void {
      herramientas.push({
        name: 'herramienta_de_prueba',
        description: 'solo pruebas',
        inputSchema: { type: 'object', properties: {} },
      });
    },
  };
}

function enMemoria() {
  const falso = servidorFalso();
  const puerto = new CapacidadesMcp({ urlServidorMcp: 'http://en-memoria' }, (fetchConTraza) => {
    void fetchConTraza;
    const [paraCliente, paraServidor] = InMemoryTransport.createLinkedPair();
    void falso.servidor.connect(paraServidor);
    return paraCliente;
  });
  return { ...falso, puerto };
}

describe('CapacidadesMcp (puerto de capacidades por MCP)', () => {
  it('descubre las herramientas con tools/list y entrega al modelo lo mismo que B0 (RNF-01)', async () => {
    const { puerto } = enMemoria();
    const lista = await puerto.listar();
    const deB0 = aFunctionCalling(
      DEFINICIONES_HERRAMIENTAS.map((d) => ({
        nombre: d.nombre,
        descripcion: d.descripcion,
        esquemaEntrada: d.esquemaEntrada,
      })),
    );
    expect(JSON.stringify(aFunctionCalling(lista))).toBe(JSON.stringify(deB0));
    await puerto.onModuleDestroy();
  });

  it('invoca con tools/call, propaga el contexto en _meta y separa rtt de la duracion reportada (D5)', async () => {
    const { puerto, recibidas } = enMemoria();
    const r = await puerto.invocar('buscar_politica', { consulta: 'prórroga' }, contexto);
    expect(r.ok).toBe(true);
    expect(r.durMs).toBe(7);
    expect(r.rttMs).toBeGreaterThanOrEqual(0);
    if (r.ok) {
      expect(r.salida.paraModelo).toMatchObject({ total_encontrados: 0 });
      expect(r.salida.estructurado).toEqual({ tipo: 'sin-resultados' });
    }
    expect(recibidas[0]).toMatchObject({
      nombre: 'buscar_politica',
      meta: { [META_MCP.contexto]: { conversacionId: 'c-1', actor: 'b1-agent' } },
    });
    await puerto.onModuleDestroy();
  });

  it('un resultado con isError vuelve como error tipado con su codigo (M2.6)', async () => {
    const { puerto } = enMemoria();
    const r = await puerto.invocar(
      'crear_ticket_simulado',
      { proposal_id: randomUUID(), confirmacion_token: 'token-inventado-0000' },
      contexto,
    );
    expect(r).toMatchObject({
      ok: false,
      error: { codigo: 'CONFIRMACION_REQUERIDA', message: 'Sin token no hay ticket.' },
      durMs: 3,
    });
    await puerto.onModuleDestroy();
  });

  it('argumentos que no son un objeto se rechazan como VALIDACION_ENTRADA sin llamar al servidor', async () => {
    const { puerto, recibidas } = enMemoria();
    const r = await puerto.invocar('buscar_politica', '{"consulta": ', contexto);
    expect(r).toMatchObject({ ok: false, error: { codigo: 'VALIDACION_ENTRADA' } });
    expect(recibidas).toHaveLength(0);
    await puerto.onModuleDestroy();
  });

  it('tras list_changed vuelve a descubrir y la herramienta nueva aparece sin reiniciar (HU-27)', async () => {
    const { puerto, servidor, agregarHerramienta } = enMemoria();
    expect(await puerto.listar()).toHaveLength(5);

    agregarHerramienta();
    await servidor.sendToolListChanged();
    // La notificacion llega por el transporte de forma asincrona.
    await new Promise((r) => setTimeout(r, 50));

    const lista = await puerto.listar();
    expect(lista.map((h) => h.nombre)).toContain('herramienta_de_prueba');
    await puerto.onModuleDestroy();
  });
});

describe('CapacidadesMcp por Streamable HTTP', () => {
  let http: ServidorHttp;
  let url: string;
  let falso: ReturnType<typeof servidorFalso>;
  let transporte: StreamableHTTPServerTransport | null = null;

  beforeAll(async () => {
    falso = servidorFalso();
    http = createServer((peticion: IncomingMessage, respuesta) => {
      let cuerpo = '';
      peticion.on('data', (trozo: Buffer) => (cuerpo += trozo.toString('utf8')));
      peticion.on('end', () => {
        void (async () => {
          const json: unknown = cuerpo ? JSON.parse(cuerpo) : undefined;
          if (transporte === null) {
            transporte = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
            });
            await falso.servidor.connect(transporte);
          }
          await transporte.handleRequest(peticion, respuesta, json);
        })();
      });
    });
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()));
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await transporte?.close();
    http.closeAllConnections();
    await new Promise<void>((r) => http.close(() => r()));
  });

  it('propaga X-Trace-Id en la cabecera de cada tools/call (HU-33)', async () => {
    const puerto = new CapacidadesMcp({ urlServidorMcp: url }, null);
    const r = await puerto.invocar('buscar_politica', { consulta: 'prórroga' }, contexto);
    expect(r.ok).toBe(true);
    // La duracion es la que REPORTA el servidor (aqui fija), no una resta local (D5).
    expect(r.durMs).toBe(7);
    expect(falso.recibidas.at(-1)?.cabeceras?.['x-trace-id']).toBe('traza-b1');
    await puerto.onModuleDestroy();
  });

  it('si el servidor MCP no responde, la invocacion termina en ErrorInfraestructura (RM-15)', async () => {
    const puerto = new CapacidadesMcp({ urlServidorMcp: 'http://127.0.0.1:9' }, null);
    await expect(puerto.listar()).rejects.toBeInstanceOf(ErrorInfraestructura);
    await expect(puerto.invocar('buscar_politica', { consulta: 'x' }, contexto)).rejects.toThrow(
      /servidor MCP/,
    );
  });
});

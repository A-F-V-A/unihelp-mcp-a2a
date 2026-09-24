import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { normalizeHeaders } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvocadorCapacidades, RegistroCapacidades } from '@unihelp/capacidades';
import { CABECERA_TRACE_ID, META_MCP } from '@unihelp/contratos';
import { McpController } from './mcp.controller';
import {
  HERRAMIENTA_DE_PRUEBA,
  capacidadDePruebaEco,
  montarRegistroDePrueba,
  type RegistroDePrueba,
} from './pruebas/registro-de-prueba';
import { ServidorHerramientasMcp } from './servidor-herramientas-mcp';
import { SesionesMcp } from './sesiones-mcp';

/**
 * El transporte real (Streamable HTTP) sobre Nest, sin PostgreSQL: capacidades
 * falsas detras del registro real. Verifica lo que el transporte en memoria no
 * puede: que la cabecera de traza llega al receptor (HU-33), que la sesion se
 * mantiene y que la notificacion de cambio viaja por el flujo SSE (HU-27).
 */
describe('servidor MCP por Streamable HTTP', () => {
  let app: INestApplication;
  let prueba: RegistroDePrueba;
  let url: URL;
  const clientes: Client[] = [];

  beforeAll(async () => {
    prueba = montarRegistroDePrueba();
    const modulo = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        { provide: RegistroCapacidades, useValue: prueba.registro },
        { provide: InvocadorCapacidades, useValue: prueba.invocador },
        ServidorHerramientasMcp,
        SesionesMcp,
      ],
    }).compile();
    app = modulo.createNestApplication();
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = new URL(`http://127.0.0.1:${port}/mcp`);
  });

  afterAll(async () => {
    await Promise.all(clientes.map((c) => c.close()));
    await app.close();
  });

  async function conectar(traceId: string): Promise<Client> {
    // Asi propaga B1 la traza: una cabecera por peticion, agregada en fetch.
    const transporte = new StreamableHTTPClientTransport(url, {
      fetch: (destino, init) =>
        fetch(destino, {
          ...init,
          headers: { ...normalizeHeaders(init?.headers), [CABECERA_TRACE_ID]: traceId },
        }),
    });
    const cliente = new Client({ name: 'b1-de-prueba', version: '0.0.0' });
    await cliente.connect(transporte);
    clientes.push(cliente);
    return cliente;
  }

  it('propaga la traza de la cabecera y el contexto de _meta hasta la capacidad (HU-33)', async () => {
    const cliente = await conectar('traza-http-1');
    const r = await cliente.callTool({
      name: 'consultar_estado_servicio',
      arguments: { servicio: 'aula_virtual' },
      _meta: { [META_MCP.contexto]: { conversacionId: 'conv-1', actor: 'b1-agent' } },
    });
    expect(r.isError).toBeFalsy();
    expect(prueba.contextos.at(-1)).toEqual({
      traceId: 'traza-http-1',
      conversacionId: 'conv-1',
      actor: 'b1-agent',
    });
    const meta = r._meta as Record<string, unknown>;
    expect(meta[META_MCP.duracionMs] as number).toBeGreaterThanOrEqual(0);
    // El dato sin sanear viaja serializado: la fecha llega como ISO 8601.
    expect(meta[META_MCP.estructurado]).toEqual({
      servicio: { codigo: 'aula_virtual' },
      desde: '2026-09-23T08:00:00.000Z',
    });
  });

  it('cada cliente tiene su sesion y todas reciben list_changed por SSE (HU-27)', async () => {
    const a = await conectar('traza-a');
    const b = await conectar('traza-b');
    const avisos = [a, b].map(
      (cliente) =>
        new Promise<void>((resolver) => {
          cliente.setNotificationHandler(ToolListChangedNotificationSchema, async () => resolver());
        }),
    );
    // Da tiempo a que cada cliente abra su flujo SSE independiente.
    await new Promise((r) => setTimeout(r, 200));

    prueba.registro.agregar(HERRAMIENTA_DE_PRUEBA, capacidadDePruebaEco());

    await Promise.all(avisos);
    const { tools } = await b.listTools();
    expect(tools.map((t) => t.name)).toContain('herramienta_de_prueba');
  }, 15_000);

  it('una peticion sin sesion que no es initialize se rechaza con 400 en español', async () => {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(respuesta.status).toBe(400);
    const cuerpo = (await respuesta.json()) as { error: { message: string } };
    expect(cuerpo.error.message).toMatch(/sesión MCP/);
  });
});

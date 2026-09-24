import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';
import { aFunctionCalling } from '@unihelp/agente-nucleo';
import { META_MCP } from '@unihelp/contratos';
import {
  DEFINICIONES_HERRAMIENTAS,
  ErrorHerramienta,
  descripcionDesdeHerramientaPublicada,
} from '@unihelp/herramientas';
import {
  HERRAMIENTA_DE_PRUEBA,
  capacidadDePruebaEco,
  montarRegistroDePrueba,
} from './pruebas/registro-de-prueba';
import {
  aHerramientaMcp,
  contextoDeLlamada,
  ServidorHerramientasMcp,
  sinPrivilegio,
} from './servidor-herramientas-mcp';

/**
 * Instantanea versionada de `tools/list` (HU-25). Cualquier cambio en una
 * herramienta exige actualizarla en el MISMO commit (RM-12):
 *
 *   UNIHELP_ACTUALIZAR_INSTANTANEA=1 pnpm nx test mcp-server
 *
 * Esta en `apps/mcp-server/contrato/` y no junto al spec para que se lea como
 * lo que es: el contrato que B1 descubre.
 */
const RUTA_INSTANTANEA = resolve(__dirname, '../../../contrato/tools-list.instantanea.json');

async function conectar() {
  const prueba = montarRegistroDePrueba();
  const servidor = new ServidorHerramientasMcp(prueba.registro, prueba.invocador).crear();
  const [paraCliente, paraServidor] = InMemoryTransport.createLinkedPair();
  const cliente = new Client({ name: 'prueba', version: '0.0.0' });
  await servidor.connect(paraServidor);
  await cliente.connect(paraCliente);
  return { ...prueba, servidor, cliente };
}

describe('tools/list (HU-25, HU-26)', () => {
  it('coincide con la instantanea versionada del contrato', async () => {
    const { cliente } = await conectar();
    const { tools } = await cliente.listTools();
    const texto = JSON.stringify(tools, null, 2) + '\n';
    if (process.env['UNIHELP_ACTUALIZAR_INSTANTANEA'] === '1' || !existsSync(RUTA_INSTANTANEA)) {
      writeFileSync(RUTA_INSTANTANEA, texto, 'utf8');
    }
    const instantanea: unknown = JSON.parse(readFileSync(RUTA_INSTANTANEA, 'utf8'));
    // Si esto falla, una herramienta cambio: revisa el cambio, regenera la
    // instantanea con UNIHELP_ACTUALIZAR_INSTANTANEA=1 y versionala en el mismo commit.
    expect(tools).toEqual(instantanea);
  });

  it('publica exactamente las cinco del contrato, con esquema de entrada Y de salida', async () => {
    const { cliente } = await conectar();
    const { tools } = await cliente.listTools();
    expect(tools).toEqual(DEFINICIONES_HERRAMIENTAS.map(aHerramientaMcp));
    for (const herramienta of tools) {
      expect(herramienta.inputSchema.type).toBe('object');
      expect(herramienta.outputSchema?.type).toBe('object');
    }
  });

  it('anota lectura e idempotencia en las consultas y destruccion en la creacion (HU-26)', async () => {
    const { cliente } = await conectar();
    const { tools } = await cliente.listTools();
    const porNombre = new Map(tools.map((t) => [t.name, t.annotations]));
    for (const consulta of ['buscar_politica', 'consultar_estado_servicio']) {
      expect(porNombre.get(consulta)).toMatchObject({
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      });
    }
    expect(porNombre.get('crear_ticket_simulado')).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
  });
});

describe('equivalencia de contrato B0 - B1 (RNF-01, H1)', () => {
  it('lo que B0 entrega al modelo y lo que B1 deriva de tools/list son identicos', async () => {
    const { cliente, puertoLocal } = await conectar();
    const { tools } = await cliente.listTools();
    const deB0 = aFunctionCalling(await puertoLocal.listar());
    const deB1 = aFunctionCalling(tools.map(descripcionDesdeHerramientaPublicada));
    // Si esto falla, el modelo recibe herramientas distintas en cada
    // arquitectura y B1 - B0 deja de medir el transporte.
    expect(deB1).toEqual(deB0);
    expect(JSON.stringify(deB1)).toBe(JSON.stringify(deB0));
  });
});

describe('tools/call', () => {
  it('devuelve el resultado estructurado, el texto que ve el modelo y la duracion del servidor (D5)', async () => {
    const { cliente } = await conectar();
    const r = await cliente.callTool({
      name: 'buscar_politica',
      arguments: { consulta: 'prórroga' },
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({
      resultados: [],
      total_encontrados: 0,
      consulta_normalizada: 'prorroga',
      motivo_sin_resultados: 'sin-coincidencias',
    });
    expect(r.content).toEqual([{ type: 'text', text: JSON.stringify(r.structuredContent) }]);
    const meta = r._meta as Record<string, unknown>;
    expect(typeof meta[META_MCP.duracionMs]).toBe('number');
    expect(meta[META_MCP.duracionMs] as number).toBeGreaterThanOrEqual(0);
    expect(meta[META_MCP.estructurado]).toEqual({
      tipo: 'sin-resultados',
      motivo: 'sin-coincidencias',
    });
  });

  it('un argumento fuera de esquema es isError con VALIDACION_ENTRADA (M2.6)', async () => {
    const { cliente } = await conectar();
    const r = await cliente.callTool({ name: 'buscar_politica', arguments: { consulta: 'ab' } });
    expect(r.isError).toBe(true);
    const meta = r._meta as Record<string, unknown>;
    expect(meta[META_MCP.error]).toMatchObject({ codigo: 'VALIDACION_ENTRADA' });
    const texto = (r.content as { text: string }[])[0]?.text ?? '';
    expect(JSON.parse(texto)).toMatchObject({ error: { codigo: 'VALIDACION_ENTRADA' } });
  });

  it('la garantia de confirmacion viene de la capacidad: CONFIRMACION_REQUERIDA identificable (HU-16)', async () => {
    const prueba = await conectar();
    prueba.fallarCon(
      'crear_ticket_simulado',
      new ErrorHerramienta(
        'CONFIRMACION_REQUERIDA',
        'No se puede crear el ticket sin confirmación.',
      ),
    );
    const r = await prueba.cliente.callTool({
      name: 'crear_ticket_simulado',
      arguments: {
        proposal_id: '3f2c9a4e-1b7d-4c8e-9f0a-2b3c4d5e6f70',
        confirmacion_token: 'token-invalido-de-prueba',
      },
    });
    expect(r.isError).toBe(true);
    expect((r._meta as Record<string, unknown>)[META_MCP.error]).toEqual({
      codigo: 'CONFIRMACION_REQUERIDA',
      mensaje: 'No se puede crear el ticket sin confirmación.',
    });
  });

  it('una herramienta desconocida es un error tipado, no un error del protocolo', async () => {
    const { cliente } = await conectar();
    const r = await cliente.callTool({ name: 'no_existe', arguments: {} });
    expect(r.isError).toBe(true);
    expect((r._meta as Record<string, unknown>)[META_MCP.error]).toMatchObject({
      codigo: 'VALIDACION_ENTRADA',
    });
  });
});

describe('cambio de la lista de herramientas (HU-27)', () => {
  it('agregar al registro notifica al cliente y la herramienta nueva ya se puede llamar', async () => {
    const { cliente, registro, servidor } = await conectar();
    // En el proceso real esta suscripcion la hace `SesionesMcp` por cada sesion
    // abierta (ver transporte-http.spec.ts); aqui no hay sesiones HTTP.
    registro.alCambiar(() => void servidor.sendToolListChanged());
    const notificado = new Promise<void>((resolver) => {
      cliente.setNotificationHandler(ToolListChangedNotificationSchema, async () => resolver());
    });

    registro.agregar(HERRAMIENTA_DE_PRUEBA, capacidadDePruebaEco());

    await notificado;
    const { tools } = await cliente.listTools();
    expect(tools.map((t: Tool) => t.name)).toEqual([
      'buscar_politica',
      'consultar_estado_servicio',
      'proponer_ticket',
      'confirmar_propuesta',
      'crear_ticket_simulado',
      'herramienta_de_prueba',
    ]);
    const r = await cliente.callTool({
      name: 'herramienta_de_prueba',
      arguments: { texto: 'hola' },
    });
    expect(r.structuredContent).toEqual({ eco: 'hola' });
  });
});

describe('contextoDeLlamada (HU-33)', () => {
  it('toma la traza de la cabecera y el resto de _meta', () => {
    const contexto = contextoDeLlamada(
      { [META_MCP.contexto]: { conversacionId: 'c-1', actor: 'b1-agent' } },
      { 'x-trace-id': 'traza-1' },
      'sesion-1',
    );
    expect(contexto).toEqual({ traceId: 'traza-1', conversacionId: 'c-1', actor: 'b1-agent' });
  });

  it('sin cabecera ni _meta usa valores derivados de la sesion: nunca queda sin traza ni actor', () => {
    expect(contextoDeLlamada(undefined, undefined, 'sesion-9')).toEqual({
      traceId: 'mcp-sesion-sesion-9',
      conversacionId: 'mcp-sesion-sesion-9',
      actor: 'cliente-mcp',
    });
  });
});

/**
 * Prueba de privilegios por agente B3 (HU-20, tarea 5.5 del plan de implementacion).
 * Un agente solo puede invocar las herramientas de su rol; el rechazo es un
 * resultado tipado (isError + SIN_AUTORIZACION), no un error del protocolo (RM-15).
 */
describe('filtro de privilegios por agente B3 (HU-20)', () => {
  it('sin X-Agent-Id (B1, inspector MCP) no aplica restriccion', () => {
    // Representa la llamada de B1 que no envia la cabecera
    expect(sinPrivilegio(undefined, 'crear_ticket_simulado')).toBeNull();
    expect(sinPrivilegio({}, 'crear_ticket_simulado')).toBeNull();
  });

  it('agente conocimiento puede invocar buscar_politica', () => {
    expect(sinPrivilegio({ 'x-agent-id': 'conocimiento' }, 'buscar_politica')).toBeNull();
  });

  it('agente diagnostico puede invocar consultar_estado_servicio', () => {
    expect(sinPrivilegio({ 'x-agent-id': 'diagnostico' }, 'consultar_estado_servicio')).toBeNull();
  });

  it('agente orquestador puede invocar proponer_ticket, confirmar_propuesta y crear_ticket_simulado', () => {
    expect(sinPrivilegio({ 'x-agent-id': 'orquestador' }, 'proponer_ticket')).toBeNull();
    expect(sinPrivilegio({ 'x-agent-id': 'orquestador' }, 'confirmar_propuesta')).toBeNull();
    expect(sinPrivilegio({ 'x-agent-id': 'orquestador' }, 'crear_ticket_simulado')).toBeNull();
  });

  it('diputado confundido: agente conocimiento no puede crear_ticket_simulado (HU-20 CA)', () => {
    const rechazo = sinPrivilegio({ 'x-agent-id': 'conocimiento' }, 'crear_ticket_simulado');
    expect(rechazo).not.toBeNull();
    expect(rechazo?.isError).toBe(true);
    const meta = rechazo?._meta as Record<string, unknown>;
    expect(meta['unihelp/error']).toMatchObject({ codigo: 'SIN_AUTORIZACION' });
    const texto = (rechazo?.content as { text: string }[])[0]?.text ?? '';
    expect(JSON.parse(texto)).toMatchObject({ error: { codigo: 'SIN_AUTORIZACION' } });
  });

  it('agente diagnostico no puede buscar_politica', () => {
    const rechazo = sinPrivilegio({ 'x-agent-id': 'diagnostico' }, 'buscar_politica');
    expect(rechazo?.isError).toBe(true);
    expect((rechazo?._meta as Record<string, unknown>)['unihelp/error']).toMatchObject({
      codigo: 'SIN_AUTORIZACION',
    });
  });

  it('agente desconocido recibe SIN_AUTORIZACION en cualquier herramienta', () => {
    const rechazo = sinPrivilegio({ 'x-agent-id': 'agente-extrano' }, 'buscar_politica');
    expect(rechazo?.isError).toBe(true);
    expect((rechazo?._meta as Record<string, unknown>)['unihelp/error']).toMatchObject({
      codigo: 'SIN_AUTORIZACION',
    });
  });

  it('el rechazo es isError, nunca lanza una excepcion del protocolo (RM-15)', () => {
    // sinPrivilegio siempre retorna un resultado tipado, nunca lanza.
    // Eso garantiza que el SDK no lo interpreta como error del protocolo y el
    // modelo puede leer el rechazo y diagnosticar el problema (RM-15).
    const rechazo = sinPrivilegio({ 'x-agent-id': 'conocimiento' }, 'crear_ticket_simulado');
    expect(() => rechazo).not.toThrow();
    expect(rechazo?.isError).toBe(true);
    expect(rechazo?._meta).toBeDefined();
    expect(rechazo?.content).toHaveLength(1);
  });
});

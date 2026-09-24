import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { normalizeHeaders } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CABECERA_TRACE_ID,
  type EntornoRestablecidoDto,
  META_MCP,
  type RespuestaMensajeDto,
  type RespuestaSalud,
  RUTA_MCP,
  RUTAS_API,
  RUTAS_EXPERIMENTO,
  type TrazaParcialDto,
} from '@unihelp/contratos';
import { ValidadorTrazas, VERSION_ESQUEMA_TRAZA } from '@unihelp/trazas';
import { parse } from 'yaml';

/**
 * Punta a punta de B1 (fase 4 del encargo): con `pnpm dev:b1` arriba, la tarea
 * compuesta T-COM-001 recorre descubrimiento, busqueda, diagnostico, propuesta,
 * confirmacion y creacion a traves de MCP, y la traza que resulta valida con AJV
 * contra el esquema de `libs/trazas`. Despues, una creacion sin token pasa por
 * MCP y queda rechazada y auditada (prueba negativa, HU-16).
 *
 * Exige: B1 en `UNIHELP_B1_URL` (por defecto :3001) con UNIHELP_PERFIL=experimento,
 * `mcp-server` en `UNIHELP_MCP_URL` (por defecto :3010), PostgreSQL migrada y
 * sembrada, y clave del proveedor (o modo replay con casetes). El resultado de
 * la tarea depende del modelo: si el agente no propone el ticket, la prueba lo
 * dice y falla, porque entonces no hay nada que confirmar.
 */
const URL_B1 = process.env['UNIHELP_B1_URL'] ?? 'http://localhost:3001';
const URL_MCP = process.env['UNIHELP_MCP_URL'] ?? 'http://localhost:3010';
const TAREA = 'T-COM-001';

interface TareaYaml {
  readonly id: string;
  readonly conversacion: readonly {
    readonly texto: string;
    readonly condicion_de_envio?: string;
  }[];
  readonly estado_inicial: { readonly overlay: string };
  readonly esperado: {
    readonly herramientas_obligatorias: readonly { readonly nombre: string }[];
    readonly ticket: { readonly debe_crearse: boolean };
  };
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, init);
  if (!respuesta.ok) {
    throw new Error(
      `${init?.method ?? 'GET'} ${url} -> ${respuesta.status} ${await respuesta.text()}`,
    );
  }
  return (await respuesta.json()) as T;
}

async function salud(url: string): Promise<RespuestaSalud> {
  try {
    return await pedir<RespuestaSalud>(`${url}/health`);
  } catch (fallo) {
    throw new Error(
      `No responde ${url}/health. Levanta B1 y mcp-server con \`pnpm dev:b1\` (UNIHELP_PERFIL=experimento). ${String(fallo)}`,
    );
  }
}

function cargarTarea(): TareaYaml {
  const ruta = resolve(__dirname, '../../../../docs/tasks', `${TAREA}.yaml`);
  return parse(readFileSync(ruta, 'utf8')) as TareaYaml;
}

/** Lo minimo que el ejecutor agrega a la traza parcial para armar la `TrazaEjecucion` (decision 32). */
function armarTraza(
  parcial: TrazaParcialDto,
  huella: string,
  conversacion: { rol: 'usuario' | 'agente'; texto: string }[],
): Record<string, unknown> {
  const llamadas = parcial.tool_calls;
  const propuso = llamadas.some((l) => l.nombre === 'proponer_ticket' && !l.isError);
  return {
    version_esquema: VERSION_ESQUEMA_TRAZA,
    run_id: `${TAREA}|B1|r1|e2e`,
    trace_id: parcial.trace_id,
    task_id: TAREA,
    condition: 'B1',
    repetition: 1,
    provenance: {
      state_hash_inicial: huella,
      semilla: 0,
      version_codigo: 'e2e',
      modelo_id: parcial.model.id,
      llm_mode: 'live',
    },
    model: parcial.model,
    timing: parcial.timing,
    usage: { ...parcial.usage, cost_usd_est: 0 },
    conversation: conversacion.map((t, i) => ({ turno: i + 1, ...t })),
    tool_calls: llamadas,
    a2a: { mensajes_totales: 0 },
    server_audit: parcial.server_audit,
    outcome: {
      status: parcial.terminaciones.every((t) => t === 'respuesta') ? 'ok' : 'error_agente',
      final_answer: conversacion.filter((t) => t.rol === 'agente').at(-1)?.texto ?? null,
      final_json: parcial.final_json,
      confirmacion_solicitada: propuso,
      confirmacion_otorgada: propuso ? parcial.tickets_creados.length > 0 : null,
      tickets_creados: parcial.tickets_creados,
    },
    errors: [],
  };
}

describe(`B1 de punta a punta con ${TAREA} por MCP`, () => {
  const traceId = `e2e-b1-${Date.now()}`;
  const tarea = cargarTarea();
  const conversacion: { rol: 'usuario' | 'agente'; texto: string }[] = [];
  let huella = '';
  let conversacionId: string | null = null;
  let parcial: TrazaParcialDto;

  beforeAll(async () => {
    const [b1, mcp] = await Promise.all([salud(URL_B1), salud(URL_MCP)]);
    expect(b1.arquitectura).toBe('B1');
    expect(mcp.servicio).toBe('mcp-server');
  });

  it('restablece el entorno de la tarea a traves de B1 (misma ruta que B0)', async () => {
    const entorno = await pedir<EntornoRestablecidoDto>(
      `${URL_B1}${RUTAS_EXPERIMENTO.restablecer}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ estadoInicial: tarea.estado_inicial.overlay, corpus: 'estandar' }),
      },
    );
    huella = entorno.huella;
    expect(huella).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(entorno.auditoriaVaciada).toBe(false);
  });

  it('recorre los turnos de la tarea: el agente propone, la persona confirma y el ticket se crea', async () => {
    for (const turno of tarea.conversacion) {
      const respuesta: RespuestaMensajeDto = await pedir(`${URL_B1}${RUTAS_API.mensajes}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [CABECERA_TRACE_ID]: traceId },
        body: JSON.stringify({ conversacionId, texto: turno.texto }),
      });
      conversacionId = respuesta.conversacionId;
      const texto = respuesta.respuesta.bloques
        .flatMap((b) => (b.tipo === 'texto' ? [b.texto] : []))
        .join('\n\n');
      conversacion.push({ rol: 'usuario', texto: turno.texto }, { rol: 'agente', texto });
      if (turno.condicion_de_envio === 'agente_pidio_confirmacion') {
        expect(respuesta.respuesta.bloques.map((b) => b.tipo)).toContain('ticket-creado');
      } else {
        // Sin propuesta no hay nada que confirmar: la tarea no se puede completar.
        expect(respuesta.accionSugerida).toBe('proponer-ticket');
      }
    }
  });

  it('la traza parcial muestra las cinco herramientas por MCP, con transporte medido por resta (D5)', async () => {
    parcial = await pedir<TrazaParcialDto>(`${URL_B1}${RUTAS_EXPERIMENTO.traza(traceId)}`);
    const nombres = parcial.tool_calls.map((l) => l.nombre);
    for (const obligatoria of tarea.esperado.herramientas_obligatorias) {
      expect(nombres).toContain(obligatoria.nombre);
    }
    for (const llamada of parcial.tool_calls) {
      expect(llamada).toMatchObject({ agente: 'b1-mcp-agente', transporte: 'mcp' });
      expect(llamada.latency_ms).toBeGreaterThan(0);
    }
    expect(parcial.timing.breakdown.transport_ms).toBeGreaterThan(0);
    expect(parcial.timing.breakdown.orchestration_ms).toBeGreaterThanOrEqual(0);
    expect(parcial.tickets_creados).toHaveLength(tarea.esperado.ticket.debe_crearse ? 1 : 0);
    // La auditoria del servidor MCP lleva la MISMA traza y el actor de B1 (HU-33).
    expect(parcial.server_audit.map((e) => e.actor)).toContain('b1-agent');
    expect(parcial.server_audit).toContainEqual(
      expect.objectContaining({ accion: 'ticket.create', resultado: 'OK', tokenValido: true }),
    );
  });

  it('la traza armada valida con AJV contra el esquema de libs/trazas', () => {
    const resultado = new ValidadorTrazas().validar(armarTraza(parcial, huella, conversacion));
    if (!resultado.valida) {
      throw new Error(JSON.stringify(resultado.errores, null, 2));
    }
    expect(resultado.valida).toBe(true);
  });

  it('prueba negativa: una creacion sin token por MCP queda rechazada y auditada (HU-16)', async () => {
    const propuesta = parcial.tool_calls.find((l) => l.nombre === 'proponer_ticket' && !l.isError);
    const proposalId = (propuesta?.resultado as { id?: string } | null)?.id;
    expect(typeof proposalId).toBe('string');

    const transporte = new StreamableHTTPClientTransport(new URL(RUTA_MCP, `${URL_MCP}/`), {
      fetch: (u, init) =>
        fetch(u, {
          ...init,
          headers: { ...normalizeHeaders(init?.headers), [CABECERA_TRACE_ID]: traceId },
        }),
    });
    const cliente = new Client({ name: 'e2e-negativa', version: '0.0.0' });
    await cliente.connect(transporte);
    try {
      const r = await cliente.callTool({
        name: 'crear_ticket_simulado',
        arguments: { proposal_id: proposalId, confirmacion_token: 'token-que-nadie-emitio-0000' },
        _meta: {
          [META_MCP.contexto]: { conversacionId: conversacionId ?? 'e2e', actor: 'e2e-negativa' },
        },
      });
      expect(r.isError).toBe(true);
      expect((r._meta as Record<string, unknown>)[META_MCP.error]).toMatchObject({
        codigo: 'CONFIRMACION_REQUERIDA',
      });
    } finally {
      await cliente.close();
    }

    const despues = await pedir<TrazaParcialDto>(`${URL_B1}${RUTAS_EXPERIMENTO.traza(traceId)}`);
    expect(despues.server_audit).toContainEqual(
      expect.objectContaining({
        accion: 'ticket.create',
        resultado: 'RECHAZADO',
        actor: 'e2e-negativa',
        tokenValido: false,
      }),
    );
    // El registro sigue con un solo ticket: el rechazo no creo nada.
    expect(despues.tickets_creados).toHaveLength(1);
  });
});

/**
 * PENDIENTE (punto 19 del encargo): la misma tarea en modo `replay` sobre B0 y
 * sobre B1 debe producir el mismo resultado salvo temporizacion. Requiere que
 * ambos procesos corran con UNIHELP_MODO_LLM=replay sobre el MISMO directorio
 * de casetes, grabado con la misma traza (el marcador de delimitacion se deriva
 * del trace_id, DP-04). La comparacion queda escrita; se activa con
 * UNIHELP_E2E_SUSTITUCION=1 y B0 en UNIHELP_B0_URL (por defecto :3000).
 */
const describirSustitucion =
  process.env['UNIHELP_E2E_SUSTITUCION'] === '1' ? describe : describe.skip;

describirSustitucion('sustitucion: B0 y B1 en replay producen el mismo resultado', () => {
  const URL_B0 = process.env['UNIHELP_B0_URL'] ?? 'http://localhost:3000';
  const traceId = `sustitucion-${TAREA}`;

  async function correr(url: string): Promise<TrazaParcialDto> {
    const tarea = cargarTarea();
    await pedir(`${url}${RUTAS_EXPERIMENTO.restablecer}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estadoInicial: tarea.estado_inicial.overlay, corpus: 'estandar' }),
    });
    let conversacionId: string | null = null;
    for (const turno of tarea.conversacion) {
      const r: RespuestaMensajeDto = await pedir(`${url}${RUTAS_API.mensajes}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [CABECERA_TRACE_ID]: traceId },
        body: JSON.stringify({ conversacionId, texto: turno.texto }),
      });
      conversacionId = r.conversacionId;
    }
    return pedir<TrazaParcialDto>(`${url}${RUTAS_EXPERIMENTO.traza(traceId)}`);
  }

  /** Lo que debe coincidir: todo salvo tiempos, identidad del emisor e identificadores generados. */
  function comparable(parcial: TrazaParcialDto) {
    return {
      terminaciones: parcial.terminaciones,
      usage: parcial.usage,
      final_json: parcial.final_json,
      llamadas: parcial.tool_calls.map((l) => ({
        seq: l.seq,
        nombre: l.nombre,
        isError: l.isError,
        resultado_status: l.resultado_status,
      })),
      tickets: parcial.tickets_creados.length,
    };
  }

  it('mismas llamadas, mismo consumo, mismo objeto final y mismo ticket', async () => {
    const [b0, b1] = [await correr(URL_B0), await correr(URL_B1)];
    expect(comparable(b1)).toEqual(comparable(b0));
  });
});

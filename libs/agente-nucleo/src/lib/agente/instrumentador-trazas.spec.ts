import type { DelegacionRegistrada } from '@unihelp/herramientas';
import { InstrumentadorTrazas } from './instrumentador-trazas';

const orquestador = {
  arquitectura: 'B3' as const,
  servicio: 'b3-a2a-orquestador',
  rol: 'orquestador' as const,
  agente: 'orquestador',
  protocolo: 'a2a' as const,
  actor: 'b3-orquestador',
};

const delegacion: DelegacionRegistrada = {
  salto: {
    de: 'orquestador',
    a: 'conocimiento',
    habilidad: 'knowledge_lookup',
    task_id: 'task-1',
    estado: 'completed',
    t_emision: '2026-09-25T00:00:00.000Z',
    t_recepcion: '2026-09-25T00:00:00.050Z',
    rtt_ms: 50,
    procesamiento_receptor_ms: 40,
  },
  medicion: {
    duracion_ms: 40,
    llm_ms: 30,
    tool_exec_ms: 5,
    transport_ms: 1,
    usage: { input_tokens: 100, output_tokens: 20, cached_input_tokens: 0, llm_calls: 2 },
    tool_calls: [
      {
        seq: 1,
        nombre: 'buscar_politica',
        args: {},
        isError: false,
        resultado_status: 'ok',
        resultado: null,
        latency_ms: 6,
        agente: 'conocimiento',
        transporte: 'mcp',
      },
    ],
    terminacion: 'respuesta',
  },
  artefactos: ['politica_aplicable'],
  transporte: 'a2a',
};

describe('InstrumentadorTrazas: fusion de una delegacion (decision 44)', () => {
  it('suma lo que midio el receptor, registra el salto y renumera sus llamadas', () => {
    const i = new InstrumentadorTrazas(orquestador);
    i.registrarModelo('t', 100, { entrada: 50, salida: 10, cacheados: 0 });
    i.registrarDelegacion(
      't',
      {
        seq: i.siguienteSeq('t'),
        nombre: 'knowledge_lookup',
        args: { consulta: 'x' },
        isError: false,
        resultado_status: 'ok',
        resultado: null,
        latency_ms: 50,
      },
      delegacion,
    );
    i.cerrarTurno('t', 200, 'respuesta');
    const m = i.de('t');

    expect(m).toMatchObject({
      llmMs: 130,
      toolExecMs: 5,
      inputTokens: 150,
      outputTokens: 30,
      llmCalls: 3,
    });
    // 1 ms de MCP dentro del especialista + (50 - 40) del salto A2A.
    expect(m.transportMs).toBeCloseTo(11);
    // El residuo sigue siendo no negativo: la duracion del receptor no se cuenta dos veces.
    expect(m.totalMs - m.llmMs - m.toolExecMs - m.transportMs).toBeGreaterThanOrEqual(0);
    expect(m.toolCalls.map((c) => [c.seq, c.nombre, c.agente, c.transporte])).toEqual([
      [1, 'knowledge_lookup', 'orquestador', 'a2a'],
      [2, 'buscar_politica', 'conocimiento', 'mcp'],
    ]);
    expect(m.a2a).toMatchObject({
      mensajesTotales: 2,
      artefactos: ['politica_aplicable'],
      hops: [{ n: 1, a: 'conocimiento', transport_ms: 10, procesamiento_receptor_ms: 40 }],
    });
  });

  it('los estados de la tarea quedan en orden y el task_id es el primero que se registro', () => {
    const i = new InstrumentadorTrazas(orquestador);
    i.registrarEstado('t', 'task-c1', 'submitted');
    i.registrarEstado('t', 'task-c1', 'working');
    i.registrarEstado('t', 'task-c1', 'input-required');
    expect(i.de('t').a2a.taskId).toBe('task-c1');
    expect(i.de('t').a2a.estados.map((e) => e.estado)).toEqual([
      'submitted',
      'working',
      'input-required',
    ]);
  });
});

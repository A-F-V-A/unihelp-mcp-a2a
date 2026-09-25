import type { A2aTaskDto } from '@unihelp/contratos';
import { META_A2A } from '@unihelp/contratos';
import type { AgenteEspecialista } from '@unihelp/multiagente-nucleo';
import { EspecialistasEnProceso } from './especialistas-en-proceso';

const solicitud = {
  habilidad: 'knowledge_lookup' as const,
  entrada: { consulta: 'prórroga', servicio: 'aula_virtual' },
  traceId: 'run-1',
  conversacionId: 'conv-1',
  tiempoRestanteMs: 60_000,
};

function especialistaFalso(demoraMs: number) {
  const atender = jest.fn(async (): Promise<A2aTaskDto> => {
    await new Promise((r) => setTimeout(r, demoraMs));
    return {
      id: 'task-conocimiento-1',
      status: 'completed',
      messages: [],
      artifacts: [
        {
          artifactId: 'politica_aplicable',
          parts: [
            { kind: 'data', data: { politicas: [], fecha: new Date('2026-09-25T00:00:00Z') } },
          ],
        },
      ],
      metadata: {
        [META_A2A.medicion]: {
          duracion_ms: demoraMs,
          llm_ms: 0,
          tool_exec_ms: 0,
          transport_ms: 0,
          usage: { input_tokens: 1, output_tokens: 1, cached_input_tokens: 0, llm_calls: 1 },
          tool_calls: [],
          terminacion: 'respuesta',
        },
      },
    };
  });
  return {
    rol: 'conocimiento',
    atender,
    onModuleDestroy: jest.fn(async () => undefined),
  } as unknown as AgenteEspecialista;
}

describe('EspecialistasEnProceso (puerto de especialistas en proceso, B2)', () => {
  it('invoca al especialista en el mismo proceso y devuelve la tarea como si hubiera viajado (RNF-01)', async () => {
    const especialista = especialistaFalso(10);
    const puerto = new EspecialistasEnProceso(new Map([['knowledge_lookup', especialista]]));
    const r = await puerto.delegar(solicitud);

    expect(especialista.atender).toHaveBeenCalledWith({
      habilidad: 'knowledge_lookup',
      entrada: solicitud.entrada,
      traceId: 'run-1',
      conversacionId: 'conv-1',
      tiempoRestanteMs: 60_000,
      hop: 1,
    });
    expect(r.tarea.id).toBe('task-conocimiento-1');
    // Tras JSON: las fechas son texto, igual que cuando llegan por red en B3.
    const dato = r.tarea.artifacts[0]?.parts[0];
    expect(dato && 'data' in dato ? (dato.data as { fecha: unknown }).fecha : null).toBe(
      '2026-09-25T00:00:00.000Z',
    );
    // La ida y vuelta se mide, no se fija en cero (D5, M4.2).
    expect(r.rttMs).toBeGreaterThanOrEqual(9);
    expect(new Date(r.tRecepcion).getTime()).toBeGreaterThanOrEqual(new Date(r.tEmision).getTime());
  });

  it('diez delegaciones concurrentes no se mezclan', async () => {
    const especialista = especialistaFalso(2);
    const puerto = new EspecialistasEnProceso(new Map([['knowledge_lookup', especialista]]));
    const resultados = await Promise.all(
      Array.from({ length: 10 }, (_, i) => puerto.delegar({ ...solicitud, traceId: `run-${i}` })),
    );
    expect(resultados).toHaveLength(10);
    expect(especialista.atender).toHaveBeenCalledTimes(10);
  });

  it('al apagar, cierra los clientes de cada especialista', async () => {
    const especialista = especialistaFalso(0);
    const puerto = new EspecialistasEnProceso(new Map([['knowledge_lookup', especialista]]));
    await puerto.onModuleDestroy();
    expect(especialista.onModuleDestroy).toHaveBeenCalled();
  });
});

import type { CapacidadesMcp } from '@unihelp/capacidades-mcp';
import { type A2aTaskDto, META_A2A, type MedicionReceptorDto } from '@unihelp/contratos';
import { ErrorInfraestructura } from '@unihelp/herramientas';
import { CapacidadesOrquestador } from './capacidades-orquestador';
import type { PuertoEspecialistas, ResultadoDelegacion } from './puerto-especialistas';

const contexto = {
  traceId: 't1',
  conversacionId: 'c1',
  actor: 'b3-orquestador',
  tiempoRestanteMs: 90_000,
};

const medicion: MedicionReceptorDto = {
  duracion_ms: 40,
  llm_ms: 30,
  tool_exec_ms: 5,
  transport_ms: 1,
  usage: { input_tokens: 100, output_tokens: 20, cached_input_tokens: 0, llm_calls: 2 },
  tool_calls: [
    {
      seq: 1,
      nombre: 'buscar_politica',
      args: { consulta: 'prórroga' },
      isError: false,
      resultado_status: 'ok',
      resultado: null,
      latency_ms: 6,
      agente: 'conocimiento',
      transporte: 'mcp',
    },
  ],
  terminacion: 'respuesta',
};

const ARTEFACTO = {
  politicas: [
    {
      codigo: 'POL-AV-003',
      titulo: 'Prórroga',
      version: '1.1',
      extracto: '5 días',
      relevancia: 0.9,
    },
  ],
  resumen: 'Cinco días.',
  confianza: 'alta',
  sin_resultados: false,
};

function tareaCompleta(): A2aTaskDto {
  return {
    id: 'task-conocimiento-1',
    status: 'completed',
    messages: [],
    artifacts: [{ artifactId: 'politica_aplicable', parts: [{ kind: 'data', data: ARTEFACTO }] }],
    metadata: { [META_A2A.medicion]: medicion },
  };
}

function montar(tarea: A2aTaskDto | Error = tareaCompleta()) {
  const especialistas = {
    delegar: jest.fn(async (): Promise<ResultadoDelegacion> => {
      if (tarea instanceof Error) {
        throw tarea;
      }
      return {
        tarea,
        rttMs: 50,
        tEmision: '2026-09-25T00:00:00.000Z',
        tRecepcion: '2026-09-25T00:00:00.050Z',
      };
    }),
  } as unknown as PuertoEspecialistas;
  const mcp = {
    listar: jest.fn(async () => [
      { nombre: 'proponer_ticket', descripcion: 'p', esquemaEntrada: { type: 'object' } },
    ]),
    invocar: jest.fn(async () => ({
      ok: true,
      salida: { paraModelo: {}, estructurado: {} },
      durMs: 2,
      rttMs: 3,
    })),
  } as unknown as CapacidadesMcp;
  const puerto = new CapacidadesOrquestador(especialistas, mcp, 'a2a');
  return { puerto, especialistas, mcp };
}

describe('CapacidadesOrquestador (puerto compuesto del orquestador, decision 44)', () => {
  it('lista las dos delegaciones y las herramientas de tickets del servidor MCP', async () => {
    const { puerto } = montar();
    expect((await puerto.listar()).map((c) => c.nombre)).toEqual([
      'knowledge_lookup',
      'incident_diagnosis',
      'proponer_ticket',
    ]);
  });

  it('una habilidad se delega y vuelve con el artefacto, el salto y la medicion del receptor (D5)', async () => {
    const { puerto, especialistas } = montar();
    const r = await puerto.invocar(
      'knowledge_lookup',
      { consulta: 'prórroga de entrega', servicio: 'aula_virtual' },
      contexto,
    );
    expect(especialistas.delegar).toHaveBeenCalledWith({
      habilidad: 'knowledge_lookup',
      entrada: { consulta: 'prórroga de entrega', servicio: 'aula_virtual' },
      traceId: 't1',
      conversacionId: 'c1',
      tiempoRestanteMs: 90_000,
    });
    expect(r.ok).toBe(true);
    expect(r.durMs).toBe(40);
    expect(r.rttMs).toBe(50);
    expect(r.delegacion).toMatchObject({
      transporte: 'a2a',
      artefactos: ['politica_aplicable'],
      medicion,
      salto: {
        de: 'orquestador',
        a: 'conocimiento',
        habilidad: 'knowledge_lookup',
        task_id: 'task-conocimiento-1',
        estado: 'completed',
        rtt_ms: 50,
        procesamiento_receptor_ms: 40,
      },
    });
    if (r.ok) {
      expect(r.salida.estructurado).toEqual(ARTEFACTO);
      // El extracto vuelve entre marcadores de la ejecucion, como en buscar_politica (HU-18).
      const paraModelo = r.salida.paraModelo as { politicas: { extracto: string }[] };
      expect(paraModelo.politicas[0]?.extracto).toMatch(/<<CONTENIDO_RECUPERADO id=UH-/);
      expect(paraModelo.politicas[0]?.extracto).toContain('5 días');
    }
  });

  it('argumentos invalidos se rechazan como VALIDACION_ENTRADA sin delegar', async () => {
    const { puerto, especialistas } = montar();
    const r = await puerto.invocar('knowledge_lookup', { consulta: 'x' }, contexto);
    expect(r).toMatchObject({ ok: false, error: { codigo: 'VALIDACION_ENTRADA' } });
    expect(especialistas.delegar).not.toHaveBeenCalled();
  });

  it('una tarea failed del especialista vuelve como error tipado, con el salto registrado igual', async () => {
    const fallida: A2aTaskDto = {
      ...tareaCompleta(),
      status: 'failed',
      artifacts: [],
      metadata: { [META_A2A.medicion]: medicion, [META_A2A.motivo]: 'agotó el tiempo' },
    };
    const { puerto } = montar(fallida);
    const r = await puerto.invocar(
      'incident_diagnosis',
      { servicio: 'aula_virtual', sintomas: 'no carga' },
      contexto,
    );
    expect(r).toMatchObject({
      ok: false,
      error: {
        codigo: 'SERVICIO_NO_DISPONIBLE',
        message: expect.stringContaining('agotó el tiempo'),
      },
      delegacion: { salto: { a: 'diagnostico', estado: 'failed' } },
    });
  });

  it('sin la medicion del receptor no hay resta posible: ErrorInfraestructura (RM-05, RM-15)', async () => {
    const { puerto } = montar({ ...tareaCompleta(), metadata: {} });
    await expect(
      puerto.invocar(
        'knowledge_lookup',
        { consulta: 'prórroga', servicio: 'aula_virtual' },
        contexto,
      ),
    ).rejects.toBeInstanceOf(ErrorInfraestructura);
  });

  it('las herramientas de tickets van al servidor MCP tal cual', async () => {
    const { puerto, mcp, especialistas } = montar();
    const r = await puerto.invocar('proponer_ticket', { servicio: 'aula_virtual' }, contexto);
    // Viaja por MCP aunque el orquestador delegue por A2A: asi se firma en la traza.
    expect(r.transporte).toBe('mcp');
    expect(mcp.invocar).toHaveBeenCalledWith(
      'proponer_ticket',
      { servicio: 'aula_virtual' },
      contexto,
    );
    expect(especialistas.delegar).not.toHaveBeenCalled();
  });
});

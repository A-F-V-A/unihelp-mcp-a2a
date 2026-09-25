import type { ClienteModelo, ConfiguracionAgente, RespuestaModelo } from '@unihelp/agente-nucleo';
import { META_A2A, type MedicionReceptorDto } from '@unihelp/contratos';
import {
  ErrorInfraestructura,
  type PuertoCapacidades,
  type ResultadoInvocacion,
} from '@unihelp/herramientas';
import { AgenteEspecialista } from './agente-especialista';

const consumo = { entrada: 10, salida: 5, cacheados: 0 };

const configuracion: ConfiguracionAgente = {
  modelo: {
    proveedor: 'openai',
    id: 'modelo-x',
    temperatura: 0.2,
    topP: 1,
    maxTokens: 2048,
    esfuerzoRazonamiento: 'none',
  },
  modelosPermitidos: ['modelo-x'],
  claveApi: null,
  modoLlm: 'replay',
  directorioCasetes: '/tmp',
  limites: { tiempoMs: 120_000, turnos: 8, llamadasHerramienta: 20 },
};

const identidad = {
  arquitectura: 'B3' as const,
  servicio: 'b3-a2a-conocimiento',
  rol: 'especialista' as const,
  agente: 'conocimiento',
  protocolo: 'mcp' as const,
  actor: 'b3-conocimiento',
};

const ARTEFACTO = {
  politicas: [
    {
      codigo: 'POL-AV-003',
      titulo: 'Prórroga',
      version: '1.1',
      extracto: 'plazo de 5 días',
      relevancia: 0.9,
    },
  ],
  resumen: 'La prórroga se pide dentro de 5 días.',
  confianza: 'alta',
  sin_resultados: false,
};

function pideHerramienta(nombre: string, args: object): RespuestaModelo {
  return {
    mensaje: {
      role: 'assistant',
      content: null,
      refusal: null,
      tool_calls: [
        { id: 'c1', type: 'function', function: { name: nombre, arguments: JSON.stringify(args) } },
      ],
    },
    consumo,
    rttMs: 100,
  };
}

function responde(texto: string): RespuestaModelo {
  return { mensaje: { role: 'assistant', content: texto, refusal: null }, consumo, rttMs: 50 };
}

function montar(respuestas: (RespuestaModelo | Error)[]) {
  const modelo = {
    completar: jest.fn(async () => {
      const siguiente = respuestas.shift();
      if (siguiente instanceof Error) {
        throw siguiente;
      }
      return siguiente as RespuestaModelo;
    }),
  } as unknown as ClienteModelo;
  const puerto = {
    listar: jest.fn(async () => []),
    invocar: jest.fn(async (): Promise<ResultadoInvocacion> => ({
      ok: true,
      salida: { paraModelo: { resultados: [] }, estructurado: { tipo: 'encontradas' } },
      durMs: 3,
      rttMs: 4,
    })),
  } as unknown as PuertoCapacidades;
  const agente = new AgenteEspecialista(
    'conocimiento',
    identidad,
    'prompt del especialista',
    modelo,
    puerto,
    configuracion,
  );
  return { agente, modelo, puerto };
}

const solicitud = {
  habilidad: 'knowledge_lookup' as const,
  entrada: { consulta: 'prórroga de entrega', servicio: 'aula_virtual' },
  traceId: 'traza-1',
  conversacionId: 'conv-1',
  tiempoRestanteMs: null,
  hop: 1,
};

describe('AgenteEspecialista', () => {
  it('atiende con el bucle del agente y devuelve el artefacto validado con su medicion (docs/03, 4 y 6)', async () => {
    const m = montar([
      pideHerramienta('buscar_politica', {
        consulta: 'prórroga de entrega',
        servicio: 'aula_virtual',
      }),
      responde(`\`\`\`json\n${JSON.stringify(ARTEFACTO)}\n\`\`\``),
    ]);
    const tarea = await m.agente.atender(solicitud);

    expect(tarea.status).toBe('completed');
    expect(tarea.artifacts[0]).toMatchObject({
      artifactId: 'politica_aplicable',
      parts: [{ kind: 'data', data: ARTEFACTO }],
    });
    const medicion = tarea.metadata?.[META_A2A.medicion] as MedicionReceptorDto;
    expect(medicion).toMatchObject({
      llm_ms: 150,
      tool_exec_ms: 3,
      transport_ms: 1,
      usage: { input_tokens: 20, output_tokens: 10, llm_calls: 2 },
      terminacion: 'respuesta',
    });
    expect(medicion.duracion_ms).toBeGreaterThanOrEqual(0);
    expect(medicion.tool_calls[0]).toMatchObject({
      seq: 1,
      nombre: 'buscar_politica',
      agente: 'conocimiento',
      transporte: 'mcp',
    });
    // El primer mensaje al modelo es el prompt del rol y la solicitud del orquestador.
    const [mensajes] = (m.modelo.completar as jest.Mock).mock.calls[0] as [
      { role: string; content: string }[],
    ];
    expect(mensajes[0]).toEqual({ role: 'system', content: 'prompt del especialista' });
    expect(mensajes[1]?.content).toContain('"consulta": "prórroga de entrega"');
    expect(tarea.messages[0]?.metadata).toMatchObject({ hop: 2, emisor: 'conocimiento' });
  });

  it('un artefacto que no cumple el esquema es una tarea failed con motivo, con su medicion', async () => {
    const m = montar([responde('```json\n{"politicas": "ninguna"}\n```')]);
    const tarea = await m.agente.atender(solicitud);
    expect(tarea.status).toBe('failed');
    expect(tarea.artifacts).toHaveLength(0);
    expect(tarea.metadata?.[META_A2A.motivo]).toMatch(/artefacto válido/);
    expect((tarea.metadata?.[META_A2A.medicion] as MedicionReceptorDto).usage.llm_calls).toBe(1);
  });

  it('sin presupuesto del orquestador no llama al modelo y termina failed por timeout (RNF-04)', async () => {
    const m = montar([responde('nunca')]);
    const tarea = await m.agente.atender({ ...solicitud, tiempoRestanteMs: 0 });
    expect(tarea.status).toBe('failed');
    expect(m.modelo.completar).not.toHaveBeenCalled();
    expect((tarea.metadata?.[META_A2A.medicion] as MedicionReceptorDto).terminacion).toBe(
      'timeout',
    );
  });

  it('una habilidad que no es la suya vuelve failed sin tocar el modelo', async () => {
    const m = montar([]);
    const tarea = await m.agente.atender({ ...solicitud, habilidad: 'incident_diagnosis' });
    expect(tarea.status).toBe('failed');
    expect(m.modelo.completar).not.toHaveBeenCalled();
  });

  it('si el proveedor del modelo falla, propaga ErrorInfraestructura: nunca un artefacto inventado (RM-15)', async () => {
    const m = montar([new ErrorInfraestructura('proveedor caído')]);
    await expect(m.agente.atender(solicitud)).rejects.toBeInstanceOf(ErrorInfraestructura);
  });

  it('dos solicitudes concurrentes con trazas distintas no mezclan sus mediciones', async () => {
    const m = montar([
      responde(`\`\`\`json\n${JSON.stringify(ARTEFACTO)}\n\`\`\``),
      responde(`\`\`\`json\n${JSON.stringify(ARTEFACTO)}\n\`\`\``),
    ]);
    const [a, b] = await Promise.all([
      m.agente.atender({ ...solicitud, traceId: 'traza-a' }),
      m.agente.atender({ ...solicitud, traceId: 'traza-b' }),
    ]);
    expect(a.id).not.toBe(b.id);
    for (const tarea of [a, b]) {
      expect((tarea.metadata?.[META_A2A.medicion] as MedicionReceptorDto).usage.llm_calls).toBe(1);
    }
  });
});

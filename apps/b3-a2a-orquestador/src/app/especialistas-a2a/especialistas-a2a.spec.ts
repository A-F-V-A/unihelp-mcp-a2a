import { createServer, type Server as ServidorHttp } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { A2aTaskDto, AgentCardDto, JsonRpcPeticionDto } from '@unihelp/contratos';
import { CODIGOS_JSONRPC, META_A2A } from '@unihelp/contratos';
import { ErrorInfraestructura } from '@unihelp/herramientas';
import { tarjetaAgente } from '@unihelp/multiagente-nucleo';
import type { RegistroA2aService } from '../registro-a2a/registro-a2a.service';
import { EspecialistasA2a } from './especialistas-a2a';

interface Recibida {
  readonly cabeceras: Record<string, string | string[] | undefined>;
  readonly cuerpo: JsonRpcPeticionDto<Record<string, unknown>>;
}

/** Especialista falso: responde una tarea completa con su medicion, tras `demoraMs`. */
async function especialistaFalso(
  responder: (peticion: JsonRpcPeticionDto<Record<string, unknown>>) => unknown,
  demoraMs = 0,
) {
  const recibidas: Recibida[] = [];
  const http: ServidorHttp = createServer((peticion, respuesta) => {
    let cuerpo = '';
    peticion.on('data', (trozo: Buffer) => (cuerpo += trozo.toString('utf8')));
    peticion.on('end', () => {
      const json = JSON.parse(cuerpo) as JsonRpcPeticionDto<Record<string, unknown>>;
      recibidas.push({ cabeceras: peticion.headers, cuerpo: json });
      setTimeout(() => {
        respuesta.setHeader('content-type', 'application/json');
        respuesta.end(JSON.stringify(responder(json)));
      }, demoraMs);
    });
  });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()));
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  return {
    url,
    recibidas,
    tarjeta: tarjetaAgente('conocimiento', url),
    async cerrar(): Promise<void> {
      http.closeAllConnections();
      await new Promise<void>((r) => http.close(() => r()));
    },
  };
}

function registroCon(tarjeta: AgentCardDto | undefined): RegistroA2aService {
  return {
    resolver: jest.fn(async (habilidad: string) =>
      tarjeta?.skills.some((s) => s.id === habilidad) ? tarjeta : undefined,
    ),
  } as unknown as RegistroA2aService;
}

const tareaCompleta = (id: string): A2aTaskDto => ({
  id,
  status: 'completed',
  messages: [],
  artifacts: [
    { artifactId: 'politica_aplicable', parts: [{ kind: 'data', data: { politicas: [] } }] },
  ],
  metadata: {
    [META_A2A.medicion]: {
      duracion_ms: 30,
      llm_ms: 20,
      tool_exec_ms: 5,
      transport_ms: 1,
      usage: { input_tokens: 10, output_tokens: 2, cached_input_tokens: 0, llm_calls: 1 },
      tool_calls: [],
      terminacion: 'respuesta',
    },
  },
});

const solicitud = {
  habilidad: 'knowledge_lookup' as const,
  entrada: { consulta: 'prórroga', servicio: 'aula_virtual' },
  traceId: 'run-1',
  conversacionId: 'conv-1',
  tiempoRestanteMs: 60_000,
};

describe('EspecialistasA2a (puerto de especialistas por A2A, B3)', () => {
  it('envia message/send con la solicitud como DataPart, la traza en cabecera y el presupuesto (HU-33)', async () => {
    const falso = await especialistaFalso(
      (p) => ({ jsonrpc: '2.0', id: p.id, result: tareaCompleta('task-1') }),
      20,
    );
    const puerto = new EspecialistasA2a(registroCon(falso.tarjeta));
    const r = await puerto.delegar(solicitud);

    expect(falso.recibidas).toHaveLength(1);
    expect(falso.recibidas[0]?.cabeceras['x-trace-id']).toBe('run-1');
    expect(falso.recibidas[0]?.cuerpo).toMatchObject({
      jsonrpc: '2.0',
      method: 'message/send',
      params: {
        contextId: 'conv-1',
        message: {
          role: 'user',
          parts: [
            { kind: 'data', data: { habilidad: 'knowledge_lookup', entrada: solicitud.entrada } },
          ],
          metadata: {
            traceId: 'run-1',
            emisor: 'orquestador',
            receptor: 'conocimiento',
            tiempo_restante_ms: 60_000,
          },
        },
      },
    });
    expect(r.tarea.id).toBe('task-1');
    // La ida y vuelta la mide el emisor e incluye la demora del receptor (D5).
    expect(r.rttMs).toBeGreaterThanOrEqual(20);
    expect(new Date(r.tRecepcion).getTime()).toBeGreaterThanOrEqual(new Date(r.tEmision).getTime());
    await falso.cerrar();
  });

  it('con el especialista caido lanza ErrorInfraestructura: nunca un diagnostico inventado (RM-15)', async () => {
    const tarjeta = tarjetaAgente('conocimiento', 'http://127.0.0.1:9');
    const puerto = new EspecialistasA2a(registroCon(tarjeta));
    await expect(puerto.delegar(solicitud)).rejects.toBeInstanceOf(ErrorInfraestructura);
  });

  it('sin especialista registrado para la habilidad, lanza ErrorInfraestructura', async () => {
    const puerto = new EspecialistasA2a(registroCon(undefined));
    await expect(puerto.delegar(solicitud)).rejects.toThrow(/ningún especialista registrado/);
  });

  it('un error JSON-RPC del especialista (infraestructura) se traduce a ErrorInfraestructura', async () => {
    const falso = await especialistaFalso((p) => ({
      jsonrpc: '2.0',
      id: p.id,
      error: {
        code: CODIGOS_JSONRPC.infraestructura,
        message: 'proveedor caído',
        data: { tipo: 'infraestructura' },
      },
    }));
    const puerto = new EspecialistasA2a(registroCon(falso.tarjeta));
    await expect(puerto.delegar(solicitud)).rejects.toThrow(/proveedor caído/);
    await falso.cerrar();
  });

  it('diez delegaciones concurrentes no mezclan tareas ni trazas', async () => {
    const falso = await especialistaFalso((p) => {
      const meta = (p.params?.['message'] as { metadata: { traceId: string } }).metadata;
      return { jsonrpc: '2.0', id: p.id, result: tareaCompleta(`task-${meta.traceId}`) };
    }, 5);
    const puerto = new EspecialistasA2a(registroCon(falso.tarjeta));
    const resultados = await Promise.all(
      Array.from({ length: 10 }, (_, i) => puerto.delegar({ ...solicitud, traceId: `run-${i}` })),
    );
    expect(new Set(resultados.map((r) => r.tarea.id)).size).toBe(10);
    resultados.forEach((r, i) => expect(r.tarea.id).toBe(`task-run-${i}`));
    await falso.cerrar();
  });
});

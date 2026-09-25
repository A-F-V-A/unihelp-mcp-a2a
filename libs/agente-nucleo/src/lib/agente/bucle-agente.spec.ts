import {
  ErrorHerramienta,
  type PuertoCapacidades,
  type ResultadoInvocacion,
} from '@unihelp/herramientas';
import type { ClienteModelo, RespuestaModelo } from '../modelo/cliente-modelo';
import { ErrorTiempoAgotado } from '../modelo/errores-modelo';
import { BucleAgente } from './bucle-agente';
import { InstrumentadorTrazas } from './instrumentador-trazas';
import type { PresupuestoEjecucion } from './presupuesto-ejecucion';

const contexto = { traceId: 't1', conversacionId: 'c1', actor: 'b0-agent' };
const consumo = { entrada: 10, salida: 5, cacheados: 0 };
const identidad = {
  arquitectura: 'B0' as const,
  servicio: 'b0-directo',
  rol: 'agente-unico' as const,
  agente: 'b0-directo',
  protocolo: 'directo' as const,
  actor: 'b0-agent',
};

function pideHerramienta(id: string, nombre: string, args: object): RespuestaModelo {
  return {
    mensaje: {
      role: 'assistant',
      content: null,
      refusal: null,
      tool_calls: [
        { id, type: 'function', function: { name: nombre, arguments: JSON.stringify(args) } },
      ],
    },
    consumo,
    rttMs: 100,
  };
}

function responde(texto: string): RespuestaModelo {
  return { mensaje: { role: 'assistant', content: texto, refusal: null }, consumo, rttMs: 50 };
}

function montar(respuestas: (RespuestaModelo | Error)[], invocacion?: ResultadoInvocacion) {
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
    invocar: jest.fn(
      async (): Promise<ResultadoInvocacion> =>
        invocacion ?? {
          ok: true,
          salida: { paraModelo: { resultados: [] }, estructurado: { tipo: 'sin-resultados' } },
          durMs: 3,
          rttMs: 4,
        },
    ),
  } as unknown as PuertoCapacidades;
  const presupuesto = { restanteMs: jest.fn(() => 60_000) } as unknown as PresupuestoEjecucion;
  const instrumentador = new InstrumentadorTrazas(identidad);
  const bucle = new BucleAgente(modelo, puerto, presupuesto, instrumentador);
  return { bucle, modelo, puerto, presupuesto, instrumentador };
}

describe('BucleAgente', () => {
  it('ejecuta la herramienta que pide el modelo y devuelve el resultado en el rol de herramienta', async () => {
    const m = montar([
      pideHerramienta('call-1', 'buscar_politica', { consulta: 'prórroga' }),
      responde('Fin'),
    ]);
    const r = await m.bucle.atender([{ role: 'user', content: 'hola' }], contexto, 0, 'modelo-x');

    expect(r.motivo).toBe('respuesta');
    expect(r.contenidoFinal).toBe('Fin');
    expect(m.modelo.completar).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Number),
      'modelo-x',
    );
    expect(m.puerto.invocar).toHaveBeenCalledWith(
      'buscar_politica',
      { consulta: 'prórroga' },
      { ...contexto, tiempoRestanteMs: 60_000 },
    );
    const herramienta = r.mensajesNuevos.find((mm) => mm.role === 'tool');
    expect(herramienta).toMatchObject({ role: 'tool', tool_call_id: 'call-1' });
  });

  it('pide al puerto las capacidades antes de CADA llamada al modelo (HU-27)', async () => {
    const m = montar([pideHerramienta('a', 'buscar_politica', { consulta: 'x' }), responde('ok')]);
    await m.bucle.atender([], contexto, 0, 'modelo-x');
    expect(m.puerto.listar).toHaveBeenCalledTimes(2);
  });

  it('instrumenta tokens, tiempos y la secuencia de llamadas (HU-34, M2.4)', async () => {
    const m = montar([pideHerramienta('a', 'buscar_politica', { consulta: 'x' }), responde('ok')]);
    await m.bucle.atender([], contexto, 0, 'modelo-x');
    const medicion = m.instrumentador.de('t1');
    expect(medicion).toMatchObject({ llmMs: 150, toolExecMs: 3, llmCalls: 2, inputTokens: 20 });
    expect(medicion.transportMs).toBeCloseTo(1);
    expect(medicion.toolCalls[0]).toMatchObject({
      seq: 1,
      nombre: 'buscar_politica',
      isError: false,
      agente: 'b0-directo',
      transporte: 'directo',
    });
  });

  it('corta con limite_herramientas cuando el receptor responde LIMITE_EXCEDIDO', async () => {
    const m = montar([pideHerramienta('a', 'buscar_politica', { consulta: 'x' })], {
      ok: false,
      error: new ErrorHerramienta('LIMITE_EXCEDIDO', 'límite'),
      durMs: 0,
      rttMs: 0,
    });
    const r = await m.bucle.atender([], contexto, 0, 'modelo-x');
    expect(r.motivo).toBe('limite_herramientas');
    expect(m.instrumentador.de('t1').toolCalls[0]?.resultado_status).toBe('LIMITE_EXCEDIDO');
  });

  it('corta con timeout sin presupuesto o si se agota durante la peticion (RNF-04)', async () => {
    const sinTiempo = montar([responde('nunca')]);
    (sinTiempo.presupuesto.restanteMs as jest.Mock).mockReturnValue(0);
    expect((await sinTiempo.bucle.atender([], contexto, 0, 'modelo-x')).motivo).toBe('timeout');
    expect(sinTiempo.modelo.completar).not.toHaveBeenCalled();

    const agotado = montar([new ErrorTiempoAgotado()]);
    expect((await agotado.bucle.atender([], contexto, 0, 'modelo-x')).motivo).toBe('timeout');
  });
});

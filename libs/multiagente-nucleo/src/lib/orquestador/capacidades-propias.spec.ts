import type { CapacidadesMcp } from '@unihelp/capacidades-mcp';
import type { PuertoCapacidades } from '@unihelp/herramientas';
import { PROMPT_ORQUESTADOR, conSeccionAdicional } from '../prompts/prompt-orquestador';
import { CapacidadesOrquestador } from './capacidades-orquestador';
import type { PuertoEspecialistas } from './puerto-especialistas';

const contexto = { traceId: 't1', conversacionId: 'c1', actor: 'b2-orquestador' };

function montar(propias: PuertoCapacidades | null) {
  const especialistas = { delegar: jest.fn() } as unknown as PuertoEspecialistas;
  const mcp = {
    listar: jest.fn(async () => [
      { nombre: 'proponer_ticket', descripcion: 'p', esquemaEntrada: { type: 'object' } },
    ]),
    invocar: jest.fn(async () => ({
      ok: true,
      salida: { paraModelo: { via: 'mcp' }, estructurado: {} },
      durMs: 2,
      rttMs: 3,
    })),
  } as unknown as CapacidadesMcp;
  return {
    puerto: new CapacidadesOrquestador(especialistas, mcp, 'en-proceso', propias),
    especialistas,
    mcp,
  };
}

function propiasFalsas() {
  return {
    listar: jest.fn(async () => [
      { nombre: 'herramienta_propia', descripcion: 'propia', esquemaEntrada: { type: 'object' } },
    ]),
    invocar: jest.fn(async () => ({
      ok: true as const,
      salida: { paraModelo: { via: 'propia' }, estructurado: {} },
      durMs: 1,
      rttMs: 1,
    })),
  };
}

describe('CapacidadesOrquestador con capacidades propias de la arquitectura (decision 60)', () => {
  it('sin capacidades propias lista lo mismo que antes: habilidades y MCP', async () => {
    const { puerto } = montar(null);
    expect((await puerto.listar()).map((d) => d.nombre)).toEqual([
      'knowledge_lookup',
      'incident_diagnosis',
      'proponer_ticket',
    ]);
  });

  it('agrega las propias al final de la lista, sin tocar el orden de las demas (RM-10)', async () => {
    const { puerto } = montar(propiasFalsas());
    expect((await puerto.listar()).map((d) => d.nombre)).toEqual([
      'knowledge_lookup',
      'incident_diagnosis',
      'proponer_ticket',
      'herramienta_propia',
    ]);
  });

  it('enruta la propia a su puerto y las de tickets siguen yendo por MCP', async () => {
    const propias = propiasFalsas();
    const { puerto, mcp, especialistas } = montar(propias);

    const r = await puerto.invocar('herramienta_propia', { a: 1 }, contexto);
    expect(r).toMatchObject({ ok: true, salida: { paraModelo: { via: 'propia' } } });
    expect(r.transporte).toBeUndefined();
    expect(propias.invocar).toHaveBeenCalledWith('herramienta_propia', { a: 1 }, contexto);

    const t = await puerto.invocar('proponer_ticket', {}, contexto);
    expect(t).toMatchObject({ salida: { paraModelo: { via: 'mcp' } }, transporte: 'mcp' });
    expect(mcp.invocar).toHaveBeenCalledTimes(1);
    expect(especialistas.delegar).not.toHaveBeenCalled();
  });
});

describe('conSeccionAdicional (delta de prompt de una arquitectura, decision 60)', () => {
  it('inserta la seccion antes de QUÉ FUENTES CONSULTAR y conserva el resto del prompt', () => {
    const prompt = conSeccionAdicional(PROMPT_ORQUESTADOR, 'SECCION PROPIA\n- regla');
    const indice = prompt.indexOf('SECCION PROPIA');
    expect(indice).toBeGreaterThan(prompt.indexOf('CÓMO TRABAJAS CON LOS ESPECIALISTAS'));
    expect(indice).toBeLessThan(prompt.indexOf('QUÉ FUENTES CONSULTAR'));
    expect(prompt.replace('\nSECCION PROPIA\n- regla\n', '')).toBe(PROMPT_ORQUESTADOR);
  });

  it('falla si el prompt ya no tiene el ancla', () => {
    expect(() => conSeccionAdicional('otro prompt', 'X')).toThrow(/QUÉ FUENTES CONSULTAR/);
  });
});

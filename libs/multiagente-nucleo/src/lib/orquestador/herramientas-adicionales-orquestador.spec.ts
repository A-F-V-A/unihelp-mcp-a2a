import type { CapacidadesMcp } from '@unihelp/capacidades-mcp';
import { NOMBRE_DISPONIBILIDAD_SOPORTE, PROMPT_BASE } from '@unihelp/herramientas';
import {
  PROMPT_ORQUESTADOR,
  SECCION_DISPONIBILIDAD_SOPORTE,
  componerPromptOrquestadorConDisponibilidad,
} from '../prompts/prompt-orquestador';
import { CapacidadesOrquestador } from './capacidades-orquestador';
import type { PuertoEspecialistas } from './puerto-especialistas';

const contexto = { traceId: 't1', conversacionId: 'c1', actor: 'b3-orquestador' };

function montar(adicionales?: readonly string[]) {
  const especialistas = { delegar: jest.fn() } as unknown as PuertoEspecialistas;
  const mcp = {
    listar: jest.fn(async () => [
      { nombre: 'proponer_ticket', descripcion: 'p', esquemaEntrada: { type: 'object' } },
      {
        nombre: NOMBRE_DISPONIBILIDAD_SOPORTE,
        descripcion: 'd',
        esquemaEntrada: { type: 'object' },
      },
    ]),
    invocar: jest.fn(async () => ({
      ok: true,
      salida: { paraModelo: { disponible: false }, estructurado: { disponible: false } },
      durMs: 1,
      rttMs: 2,
    })),
  } as unknown as CapacidadesMcp;
  const puerto =
    adicionales === undefined
      ? new CapacidadesOrquestador(especialistas, mcp, 'en-proceso')
      : new CapacidadesOrquestador(especialistas, mcp, 'a2a', adicionales);
  return { puerto, mcp };
}

describe('sexta herramienta en el orquestador: habilitada solo por la arquitectura (HU-43)', () => {
  it('sin habilitarla (B2), el modelo no la ve aunque el servidor MCP la publique al rol', async () => {
    const { puerto } = montar();
    expect((await puerto.listar()).map((c) => c.nombre)).toEqual([
      'knowledge_lookup',
      'incident_diagnosis',
      'proponer_ticket',
    ]);
  });

  it('sin habilitarla, invocarla se rechaza sin llegar al servidor MCP', async () => {
    const { puerto, mcp } = montar();
    const r = await puerto.invocar(
      NOMBRE_DISPONIBILIDAD_SOPORTE,
      { sede: 'norte', fecha: '2026-10-12' },
      contexto,
    );
    expect(r).toMatchObject({ ok: false, error: { codigo: 'VALIDACION_ENTRADA' } });
    expect(mcp.invocar).not.toHaveBeenCalled();
  });

  it('habilitada (B3), aparece en la lista y viaja por MCP', async () => {
    const { puerto, mcp } = montar([NOMBRE_DISPONIBILIDAD_SOPORTE]);
    expect((await puerto.listar()).map((c) => c.nombre)).toContain(NOMBRE_DISPONIBILIDAD_SOPORTE);
    const r = await puerto.invocar(
      NOMBRE_DISPONIBILIDAD_SOPORTE,
      { sede: 'norte', fecha: '2026-10-12' },
      contexto,
    );
    expect(r).toMatchObject({ ok: true, transporte: 'mcp' });
    expect(mcp.invocar).toHaveBeenCalledWith(
      NOMBRE_DISPONIBILIDAD_SOPORTE,
      { sede: 'norte', fecha: '2026-10-12' },
      contexto,
    );
  });
});

describe('prompt del orquestador con la sexta herramienta', () => {
  it('agrega la seccion antes de QUE FUENTES CONSULTAR y conserva el resto intacto', () => {
    const prompt = componerPromptOrquestadorConDisponibilidad();
    expect(prompt).toContain(SECCION_DISPONIBILIDAD_SOPORTE);
    expect(prompt.indexOf(SECCION_DISPONIBILIDAD_SOPORTE)).toBeLessThan(
      prompt.indexOf('\nQUÉ FUENTES CONSULTAR'),
    );
    expect(prompt.replace(`\n${SECCION_DISPONIBILIDAD_SOPORTE}\n`, '')).toBe(PROMPT_ORQUESTADOR);
    expect(prompt).toContain(NOMBRE_DISPONIBILIDAD_SOPORTE);
  });

  it('el prompt por defecto (B2) no cambia y no menciona la herramienta', () => {
    expect(PROMPT_ORQUESTADOR).not.toContain(NOMBRE_DISPONIBILIDAD_SOPORTE);
    expect(PROMPT_BASE).not.toContain(NOMBRE_DISPONIBILIDAD_SOPORTE);
  });

  it('falla en vez de callar si el prompt ya no tiene el ancla', () => {
    expect(() => componerPromptOrquestadorConDisponibilidad('sin ancla')).toThrow(
      /QUÉ FUENTES CONSULTAR/,
    );
  });
});

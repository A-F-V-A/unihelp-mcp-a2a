import { DEFINICIONES_HERRAMIENTAS } from './definiciones-herramientas';
import {
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  promptConDisponibilidadSoporte,
  SECCION_PROMPT_DISPONIBILIDAD_SOPORTE,
} from './disponibilidad-soporte';
import { PROMPT_BASE } from './prompt-base';

describe('sexta herramienta: consultar_disponibilidad_soporte (HU-43)', () => {
  it('no altera el contrato de las cinco que comparten todas las arquitecturas', () => {
    expect(DEFINICIONES_HERRAMIENTAS).toHaveLength(5);
    expect(DEFINICIONES_HERRAMIENTAS.map((d) => d.nombre)).not.toContain(
      DEFINICION_DISPONIBILIDAD_SOPORTE.nombre,
    );
  });

  it('es de solo lectura y exige sede y fecha', () => {
    expect(DEFINICION_DISPONIBILIDAD_SOPORTE.anotaciones).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    });
    expect(DEFINICION_DISPONIBILIDAD_SOPORTE.esquemaEntrada['required']).toEqual(['sede', 'fecha']);
  });

  it('el prompt suma la seccion despues de ALCANCE y conserva el base intacto', () => {
    const prompt = promptConDisponibilidadSoporte();
    expect(prompt.replace(`${SECCION_PROMPT_DISPONIBILIDAD_SOPORTE}\n\n`, '')).toBe(PROMPT_BASE);
    expect(prompt.indexOf('DISPONIBILIDAD DEL SOPORTE')).toBeGreaterThan(prompt.indexOf('ALCANCE'));
    expect(prompt.indexOf('DISPONIBILIDAD DEL SOPORTE')).toBeLessThan(
      prompt.indexOf('QUÉ FUENTES CONSULTAR'),
    );
  });

  it('falla en vez de componer un prompt sin la seccion ancla', () => {
    expect(() => promptConDisponibilidadSoporte('sin secciones')).toThrow(/QUÉ FUENTES/);
  });
});

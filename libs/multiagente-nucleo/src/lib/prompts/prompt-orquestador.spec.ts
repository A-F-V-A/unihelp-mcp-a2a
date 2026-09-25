import { PROMPT_BASE, seccionPromptBase } from '@unihelp/herramientas';
import {
  PROMPT_ORQUESTADOR,
  SECCION_COORDINACION,
  SUSTITUCIONES_PROMPT_ORQUESTADOR,
  componerPromptOrquestador,
} from './prompt-orquestador';
import {
  PROMPT_ESPECIALISTA_CONOCIMIENTO,
  PROMPT_ESPECIALISTA_DIAGNOSTICO,
} from './prompts-especialistas';

describe('PROMPT_ORQUESTADOR: un delta publicado sobre el prompt base (decision 44)', () => {
  it('cada fragmento sustituido sigue existiendo en el prompt base', () => {
    for (const [fragmento] of SUSTITUCIONES_PROMPT_ORQUESTADOR) {
      expect(PROMPT_BASE).toContain(fragmento);
    }
  });

  it('el modelo del orquestador no ve las herramientas de lectura, sino las delegaciones', () => {
    expect(PROMPT_ORQUESTADOR).not.toContain('buscar_politica');
    expect(PROMPT_ORQUESTADOR).not.toContain('consultar_estado_servicio');
    expect(PROMPT_ORQUESTADOR).toContain('knowledge_lookup');
    expect(PROMPT_ORQUESTADOR).toContain('incident_diagnosis');
    expect(PROMPT_ORQUESTADOR).toContain(SECCION_COORDINACION);
  });

  it('las reglas de prioridad, tickets, seguridad y formato son las MISMAS palabras que en B0/B1', () => {
    for (const encabezado of [
      'TABLA INSTITUCIONAL DE PRIORIDAD',
      'REGISTRO DE TICKETS',
      'SEGURIDAD',
      'FORMATO DE LA RESPUESTA FINAL',
    ] as const) {
      const seccion = seccionPromptBase(encabezado);
      // Solo cambian los nombres de las herramientas de lectura dentro de esas secciones.
      const esperada = SUSTITUCIONES_PROMPT_ORQUESTADOR.reduce(
        (texto, [de, a]) => texto.split(de).join(a),
        seccion,
      );
      expect(PROMPT_ORQUESTADOR).toContain(esperada);
    }
  });

  it('si el prompt base pierde un fragmento del delta, la composicion falla en vez de callar', () => {
    const baseSinFiltro = PROMPT_BASE.replace(
      ' El filtro categoria, en cambio, no lo uses: excluye y casi siempre esconde la política correcta.',
      '',
    );
    expect(() => componerPromptOrquestador(baseSinFiltro)).toThrow(/actualiza el delta/);
  });
});

describe('prompts de los especialistas: secciones enteras del prompt base', () => {
  it('el de conocimiento busca con las mismas reglas que el agente unico', () => {
    expect(PROMPT_ESPECIALISTA_CONOCIMIENTO).toContain(
      seccionPromptBase('CÓMO BUSCAR UNA POLÍTICA'),
    );
    expect(PROMPT_ESPECIALISTA_CONOCIMIENTO).toContain(seccionPromptBase('SEGURIDAD'));
    expect(PROMPT_ESPECIALISTA_CONOCIMIENTO).toContain('"sin_resultados"');
  });

  it('el de diagnostico aplica la misma tabla de prioridad', () => {
    expect(PROMPT_ESPECIALISTA_DIAGNOSTICO).toContain(
      seccionPromptBase('TABLA INSTITUCIONAL DE PRIORIDAD'),
    );
    expect(PROMPT_ESPECIALISTA_DIAGNOSTICO).toContain('"accion_recomendada"');
  });
});

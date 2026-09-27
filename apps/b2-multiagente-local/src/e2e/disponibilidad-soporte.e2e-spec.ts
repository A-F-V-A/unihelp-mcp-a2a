import {
  CABECERA_TRACE_ID,
  type RespuestaMensajeDto,
  type RespuestaSalud,
  RUTAS_API,
  RUTAS_EXPERIMENTO,
  type TrazaParcialDto,
} from '@unihelp/contratos';

/**
 * Caso de aceptacion 9 de la sexta herramienta (HU-43, decision 60): con B2 y
 * `mcp-server` arriba (`pnpm dev:b2`, UNIHELP_PERFIL=experimento) y el modelo
 * configurado (Ollama en local), la pregunta por el soporte presencial de la
 * sede norte en un festivo hace que el orquestador llame a
 * `consultar_disponibilidad_soporte` y responda que no, por festivo, sin
 * inventar horarios. El resultado depende del modelo: si no llama a la
 * herramienta, la prueba lo dice y falla.
 */
const URL_B2 = process.env['UNIHELP_B2_URL'] ?? 'http://localhost:3002';
const PREGUNTA = '¿Hay soporte presencial en la sede norte el lunes 12 de octubre de 2026?';

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, init);
  if (!respuesta.ok) {
    throw new Error(
      `${init?.method ?? 'GET'} ${url} -> ${respuesta.status} ${await respuesta.text()}`,
    );
  }
  return (await respuesta.json()) as T;
}

describe('B2 de punta a punta: consultar_disponibilidad_soporte (caso 9)', () => {
  const traceId = `e2e-b2-soporte-${Date.now()}`;
  let texto = '';

  beforeAll(async () => {
    const salud = await pedir<RespuestaSalud>(`${URL_B2}/health`).catch((fallo: unknown) => {
      throw new Error(`No responde ${URL_B2}/health. Levanta B2 con \`pnpm dev:b2\`. ${fallo}`);
    });
    expect(salud.arquitectura).toBe('B2');
  });

  it('el orquestador responde la pregunta', async () => {
    const respuesta: RespuestaMensajeDto = await pedir(`${URL_B2}${RUTAS_API.mensajes}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CABECERA_TRACE_ID]: traceId },
      body: JSON.stringify({ conversacionId: null, texto: PREGUNTA }),
    });
    texto = respuesta.respuesta.bloques
      .flatMap((b) => (b.tipo === 'texto' ? [b.texto] : []))
      .join('\n\n');
    expect(texto.length).toBeGreaterThan(0);
  });

  it('llamo a la herramienta con la sede y la fecha, y esta respondio festivo', async () => {
    const parcial = await pedir<TrazaParcialDto>(`${URL_B2}${RUTAS_EXPERIMENTO.traza(traceId)}`);
    const llamadas = parcial.tool_calls.filter(
      (l) => l.nombre === 'consultar_disponibilidad_soporte' && !l.isError,
    );
    expect(llamadas.length).toBeGreaterThan(0);
    expect(llamadas[0]?.args).toEqual({ sede: 'norte', fecha: '2026-10-12' });
    expect(llamadas[0]?.resultado).toMatchObject({
      disponible: false,
      franjas: [],
      motivo: 'festivo',
    });
    expect(llamadas[0]).toMatchObject({ agente: 'orquestador' });
    // Sin tickets ni delegaciones para esta pregunta.
    expect(parcial.tool_calls.map((l) => l.nombre)).not.toContain('proponer_ticket');
    expect(parcial.tickets_creados).toHaveLength(0);
  });

  it('la respuesta dice que no hay atencion por festivo y no inventa horarios', () => {
    expect(texto).toMatch(/festivo/i);
    expect(texto).toMatch(/\bno\b/i);
    expect(texto).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });
});

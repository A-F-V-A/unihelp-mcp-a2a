import {
  CABECERA_TRACE_ID,
  type RespuestaMensajeDto,
  type RespuestaSalud,
  RUTAS_API,
  RUTAS_EXPERIMENTO,
  type TrazaParcialDto,
} from '@unihelp/contratos';

/**
 * Caso de aceptacion 9 de la sexta herramienta (HU-43), de punta a punta: B1
 * descubre `consultar_disponibilidad_soporte` por `tools/list` de `mcp-server`,
 * el modelo la llama ante una pregunta de disponibilidad y responde que no hay
 * atencion por festivo, sin inventar horarios.
 *
 * Exige lo mismo que `punta-a-punta.e2e-spec.ts`: B1 en `UNIHELP_B1_URL` con
 * UNIHELP_PERFIL=experimento y `mcp-server` arriba. Con Ollama (decision 46) no
 * gasta API de pago. El resultado depende del modelo: si no llama a la
 * herramienta, la prueba lo dice y falla.
 */
const URL_B1 = process.env['UNIHELP_B1_URL'] ?? 'http://localhost:3001';
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

describe('B1 usa consultar_disponibilidad_soporte (HU-43, caso 9)', () => {
  const traceId = `e2e-b1-disponibilidad-${Date.now()}`;
  let texto = '';
  let parcial: TrazaParcialDto;

  beforeAll(async () => {
    const salud = await pedir<RespuestaSalud>(`${URL_B1}/health`);
    expect(salud.arquitectura).toBe('B1');
    const respuesta = await pedir<RespuestaMensajeDto>(`${URL_B1}${RUTAS_API.mensajes}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CABECERA_TRACE_ID]: traceId },
      body: JSON.stringify({ conversacionId: null, texto: PREGUNTA }),
    });
    texto = respuesta.respuesta.bloques
      .flatMap((b) => (b.tipo === 'texto' ? [b.texto] : []))
      .join('\n\n');
    parcial = await pedir<TrazaParcialDto>(`${URL_B1}${RUTAS_EXPERIMENTO.traza(traceId)}`);
  });

  it('llama a la herramienta por MCP con la sede norte y la fecha 2026-10-12', () => {
    const llamadas = parcial.tool_calls.filter(
      (l) => l.nombre === 'consultar_disponibilidad_soporte' && !l.isError,
    );
    expect(llamadas.length).toBeGreaterThanOrEqual(1);
    const llamada = llamadas[0];
    expect(llamada?.args).toEqual({ sede: 'norte', fecha: '2026-10-12' });
    expect(llamada?.transporte).toBe('mcp');
    expect(llamada?.resultado).toMatchObject({ disponible: false, motivo: 'festivo', franjas: [] });
  });

  it('responde que no hay atencion por festivo, sin inventar horarios', () => {
    expect(texto).toMatch(/festivo/i);
    expect(texto).toMatch(/\bno\b/i);
    // Ningun horario: la herramienta no devolvio franjas.
    expect(texto).not.toMatch(/\b\d{1,2}:\d{2}\b/);
    expect(texto).not.toMatch(/\b\d{1,2}\s*(a\.?\s*m\.?|p\.?\s*m\.?)/i);
  });
});

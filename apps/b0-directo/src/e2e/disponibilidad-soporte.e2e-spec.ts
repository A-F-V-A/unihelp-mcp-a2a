import {
  CABECERA_TRACE_ID,
  type RespuestaMensajeDto,
  type RespuestaSalud,
  RUTAS_API,
  RUTAS_EXPERIMENTO,
  type TrazaParcialDto,
} from '@unihelp/contratos';

/**
 * Punta a punta de la sexta herramienta en B0 (HU-43, caso de aceptacion 9): ante
 * una pregunta por soporte presencial en un festivo, el agente llama a
 * `consultar_disponibilidad_soporte` y responde que no, por festivo, sin
 * inventar horarios. Exige B0 en `UNIHELP_B0_URL` (por defecto :3000) con
 * UNIHELP_PERFIL=experimento (la traza se lee por la ruta del ejecutor) y un
 * modelo real: con Ollama no gasta API de pago. No forma parte de `pnpm verify`;
 * se corre con `pnpm nx e2e b0-directo`.
 */
const URL_B0 = process.env['UNIHELP_B0_URL'] ?? 'http://localhost:3000';
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

describe('B0 de punta a punta con consultar_disponibilidad_soporte', () => {
  const traceId = `e2e-b0-soporte-${Date.now()}`;
  let texto = '';
  let parcial: TrazaParcialDto;

  beforeAll(async () => {
    const salud = await pedir<RespuestaSalud>(`${URL_B0}/health`);
    expect(salud.arquitectura).toBe('B0');
    const respuesta = await pedir<RespuestaMensajeDto>(`${URL_B0}${RUTAS_API.mensajes}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CABECERA_TRACE_ID]: traceId },
      body: JSON.stringify({ conversacionId: null, texto: PREGUNTA }),
    });
    texto = respuesta.respuesta.bloques
      .flatMap((b) => (b.tipo === 'texto' ? [b.texto] : []))
      .join('\n\n');
    parcial = await pedir<TrazaParcialDto>(`${URL_B0}${RUTAS_EXPERIMENTO.traza(traceId)}`);
  });

  it('el agente llama a la herramienta con la sede y la fecha de la pregunta', () => {
    const llamada = parcial.tool_calls.find(
      (l) => l.nombre === 'consultar_disponibilidad_soporte' && !l.isError,
    );
    expect(llamada?.args).toEqual({ sede: 'norte', fecha: '2026-10-12' });
    expect(llamada?.resultado).toMatchObject({ disponible: false, motivo: 'festivo' });
    // Es una consulta, no un incidente: no propone ticket.
    expect(parcial.tool_calls.map((l) => l.nombre)).not.toContain('proponer_ticket');
  });

  it('responde que no hay soporte por festivo, sin inventar horarios', () => {
    expect(texto).toMatch(/festivo/i);
    expect(texto).toMatch(/\bno\b/i);
    expect(texto).not.toMatch(/\d{1,2}:\d{2}/);
  });
});

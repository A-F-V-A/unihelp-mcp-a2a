import {
  CABECERA_TRACE_ID,
  type RespuestaMensajeDto,
  type RespuestaSalud,
  RUTAS_API,
  RUTAS_EXPERIMENTO,
  type TrazaParcialDto,
} from '@unihelp/contratos';
import { NOMBRE_DISPONIBILIDAD_SOPORTE } from '@unihelp/herramientas';

/**
 * Punta a punta de la sexta herramienta en B3 (HU-43, caso de aceptacion 9):
 * ante la pregunta por soporte presencial en la sede norte un festivo, el
 * orquestador llama a `consultar_disponibilidad_soporte` por MCP y responde que
 * no hay atencion por festivo, sin inventar horarios.
 *
 * Exige `pnpm dev:b3` con UNIHELP_PERFIL=experimento (la traza parcial) y el
 * modelo configurado en el `.env` del orquestador (Ollama en desarrollo). El
 * resultado depende del modelo: si no llama a la herramienta, la prueba falla.
 */
const URL_B3 = process.env['UNIHELP_B3_URL'] ?? 'http://localhost:3003';
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

describe('B3 de punta a punta: consultar_disponibilidad_soporte (HU-43)', () => {
  const traceId = `e2e-b3-disponibilidad-${Date.now()}`;
  let texto = '';

  beforeAll(async () => {
    const salud = await pedir<RespuestaSalud>(`${URL_B3}/health`);
    expect(salud.arquitectura).toBe('B3');
  });

  it('responde que no hay soporte presencial por festivo, sin horarios', async () => {
    const respuesta = await pedir<RespuestaMensajeDto>(`${URL_B3}${RUTAS_API.mensajes}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CABECERA_TRACE_ID]: traceId },
      body: JSON.stringify({ conversacionId: null, texto: PREGUNTA }),
    });
    texto = respuesta.respuesta.bloques
      .flatMap((b) => (b.tipo === 'texto' ? [b.texto] : []))
      .join('\n\n');
    expect(texto.toLowerCase()).toMatch(/\bno\b/);
    expect(texto.toLowerCase()).toContain('festivo');
    // Ningun horario: la herramienta devolvio franjas vacias.
    expect(texto).not.toMatch(/\b\d{1,2}:\d{2}\b/);
    expect(respuesta.accionSugerida).not.toBe('proponer-ticket');
  });

  it('la traza muestra la llamada a la herramienta por MCP, con sede y fecha correctas', async () => {
    const parcial = await pedir<TrazaParcialDto>(`${URL_B3}${RUTAS_EXPERIMENTO.traza(traceId)}`);
    const llamada = parcial.tool_calls.find(
      (l) => l.nombre === NOMBRE_DISPONIBILIDAD_SOPORTE && !l.isError,
    );
    expect(llamada).toBeDefined();
    expect(llamada).toMatchObject({
      args: { sede: 'norte', fecha: '2026-10-12' },
      agente: 'orquestador',
      transporte: 'mcp',
    });
    expect(llamada?.resultado).toMatchObject({ disponible: false, motivo: 'festivo', franjas: [] });
    expect(parcial.tickets_creados).toHaveLength(0);
  });
});

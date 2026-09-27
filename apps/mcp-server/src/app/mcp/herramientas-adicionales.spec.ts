import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ConsultarDisponibilidadSoporteCapacidad } from '@unihelp/capacidades';
import { META_MCP } from '@unihelp/contratos';
import {
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  DEFINICIONES_HERRAMIENTAS,
  NOMBRE_DISPONIBILIDAD_SOPORTE,
} from '@unihelp/herramientas';
import { HerramientasAdicionales } from './herramientas-adicionales';
import { montarRegistroDePrueba } from './pruebas/registro-de-prueba';
import {
  aHerramientaMcp,
  ServidorHerramientasMcp,
  sinPrivilegio,
} from './servidor-herramientas-mcp';

/**
 * La sexta herramienta en el servidor MCP (HU-43): se registra de forma aditiva
 * y solo la ve y la invoca el rol con permiso (el orquestador). Sin rol, el
 * servidor se comporta exactamente como antes: es lo que descubre B1.
 *
 * `InMemoryTransport` no lleva cabeceras HTTP, asi que el rol se inyecta en el
 * `requestInfo` de cada mensaje, como lo haria el transporte Streamable HTTP.
 */
async function conectar(agente: string | null) {
  const prueba = montarRegistroDePrueba();
  new HerramientasAdicionales(
    prueba.registro,
    new ConsultarDisponibilidadSoporteCapacidad(),
  ).onModuleInit();
  const servidor = new ServidorHerramientasMcp(prueba.registro, prueba.invocador).crear();
  const [paraCliente, paraServidor] = InMemoryTransport.createLinkedPair();
  // El servidor fija `onmessage` antes de `start`: ahi se envuelve para agregar la cabecera.
  const iniciar = paraServidor.start.bind(paraServidor);
  paraServidor.start = async () => {
    const alRecibir = paraServidor.onmessage;
    paraServidor.onmessage = (mensaje, extra) =>
      alRecibir?.(mensaje, {
        ...extra,
        // El tipo de InMemoryTransport no declara `requestInfo`, pero el protocolo lo lee.
        requestInfo: { headers: agente === null ? {} : { 'x-agent-id': agente } },
      } as Parameters<NonNullable<typeof alRecibir>>[1]);
    await iniciar();
  };
  const cliente = new Client({ name: 'prueba', version: '0.0.0' });
  await servidor.connect(paraServidor);
  await cliente.connect(paraCliente);
  return { ...prueba, cliente };
}

describe('herramienta adicional consultar_disponibilidad_soporte en mcp-server (HU-43)', () => {
  it('se registra una sola vez, despues de las cinco del contrato', () => {
    const prueba = montarRegistroDePrueba();
    const adicionales = new HerramientasAdicionales(
      prueba.registro,
      new ConsultarDisponibilidadSoporteCapacidad(),
    );
    adicionales.onModuleInit();
    adicionales.onModuleInit();
    expect(prueba.registro.definiciones.map((d) => d.nombre)).toEqual([
      ...DEFINICIONES_HERRAMIENTAS.map((d) => d.nombre),
      NOMBRE_DISPONIBILIDAD_SOPORTE,
    ]);
  });

  it('sin rol (B1, inspector) tools/list sigue siendo exactamente el contrato de cinco', async () => {
    const { cliente } = await conectar(null);
    const { tools } = await cliente.listTools();
    expect(tools).toEqual(DEFINICIONES_HERRAMIENTAS.map(aHerramientaMcp));
  });

  it('con X-Agent-Id: orquestador, tools/list la incluye con sus esquemas y anotaciones', async () => {
    const { cliente } = await conectar('orquestador');
    const { tools } = await cliente.listTools();
    expect(tools.find((t) => t.name === NOMBRE_DISPONIBILIDAD_SOPORTE)).toEqual(
      aHerramientaMcp(DEFINICION_DISPONIBILIDAD_SOPORTE),
    );
  });

  it('otro rol no la ve en tools/list', async () => {
    const { cliente } = await conectar('diagnostico');
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name)).not.toContain(NOMBRE_DISPONIBILIDAD_SOPORTE);
  });

  it('el orquestador la invoca por MCP y recibe la salida estructurada', async () => {
    const { cliente } = await conectar('orquestador');
    const r = await cliente.callTool({
      name: NOMBRE_DISPONIBILIDAD_SOPORTE,
      arguments: { sede: 'norte', fecha: '2026-10-12' },
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({
      sede: 'norte',
      fecha: '2026-10-12',
      dia_semana: 'lunes',
      disponible: false,
      franjas: [],
      motivo: 'festivo',
    });
  });

  it('un argumento invalido vuelve como VALIDACION_ENTRADA en español', async () => {
    const { cliente } = await conectar('orquestador');
    const r = await cliente.callTool({
      name: NOMBRE_DISPONIBILIDAD_SOPORTE,
      arguments: { sede: 'oriente', fecha: '2026-10-12' },
    });
    expect(r.isError).toBe(true);
    expect((r._meta as Record<string, unknown>)[META_MCP.error]).toMatchObject({
      codigo: 'VALIDACION_ENTRADA',
      mensaje: expect.stringContaining('central, norte, sur, virtual'),
    });
  });

  it('privilegios: el orquestador puede, otro rol o un cliente sin rol no', () => {
    expect(
      sinPrivilegio({ 'x-agent-id': 'orquestador' }, NOMBRE_DISPONIBILIDAD_SOPORTE),
    ).toBeNull();
    expect(
      sinPrivilegio({ 'x-agent-id': 'conocimiento' }, NOMBRE_DISPONIBILIDAD_SOPORTE),
    ).toMatchObject({ isError: true });
    expect(sinPrivilegio({}, NOMBRE_DISPONIBILIDAD_SOPORTE)).toMatchObject({ isError: true });
    // Las cinco del contrato siguen abiertas sin rol.
    expect(sinPrivilegio({}, 'buscar_politica')).toBeNull();
  });
});

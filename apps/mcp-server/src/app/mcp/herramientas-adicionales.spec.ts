import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { META_MCP } from '@unihelp/contratos';
import {
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  DEFINICIONES_HERRAMIENTAS,
  descripcionDesdeHerramientaPublicada,
} from '@unihelp/herramientas';
import {
  agregarHerramientasAdicionales,
  HerramientasAdicionales,
} from './herramientas-adicionales';
import { montarRegistroDePrueba } from './pruebas/registro-de-prueba';
import {
  aHerramientaMcp,
  ServidorHerramientasMcp,
  sinPrivilegio,
} from './servidor-herramientas-mcp';

/**
 * La sexta herramienta, `consultar_disponibilidad_soporte`, publicada por
 * `mcp-server` a traves del registro aditivo (HU-27, HU-43). Los casos de
 * aceptacion 1 a 8 viajan aqui por MCP, como los vera el agente de B1.
 *
 * Su forma publicada en `tools/list` esta versionada aparte de la instantanea de
 * las cinco (RM-12); se regenera igual:
 *   UNIHELP_ACTUALIZAR_INSTANTANEA=1 pnpm nx test mcp-server
 */
const RUTA_INSTANTANEA = resolve(
  __dirname,
  '../../../contrato/consultar-disponibilidad-soporte.instantanea.json',
);
const NOMBRE = 'consultar_disponibilidad_soporte';

async function conectar() {
  const prueba = montarRegistroDePrueba();
  agregarHerramientasAdicionales(prueba.registro);
  const servidor = new ServidorHerramientasMcp(prueba.registro, prueba.invocador).crear();
  const [paraCliente, paraServidor] = InMemoryTransport.createLinkedPair();
  const cliente = new Client({ name: 'prueba', version: '0.0.0' });
  await servidor.connect(paraServidor);
  await cliente.connect(paraCliente);
  return { ...prueba, cliente };
}

async function llamar(argumentos: Record<string, unknown>) {
  const { cliente } = await conectar();
  return cliente.callTool({ name: NOMBRE, arguments: argumentos });
}

describe('registro de la sexta herramienta en mcp-server (HU-27, HU-43)', () => {
  it('se publica despues de las cinco del contrato, sin tocarlas', async () => {
    const { cliente } = await conectar();
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      ...DEFINICIONES_HERRAMIENTAS.map((d) => d.nombre),
      NOMBRE,
    ]);
    expect(tools.slice(0, 5)).toEqual(DEFINICIONES_HERRAMIENTAS.map(aHerramientaMcp));
  });

  it('coincide con su instantanea versionada (RM-12)', async () => {
    const { cliente } = await conectar();
    const { tools } = await cliente.listTools();
    const publicada = tools.find((t) => t.name === NOMBRE);
    const texto = JSON.stringify(publicada, null, 2) + '\n';
    if (process.env['UNIHELP_ACTUALIZAR_INSTANTANEA'] === '1' || !existsSync(RUTA_INSTANTANEA)) {
      writeFileSync(RUTA_INSTANTANEA, texto, 'utf8');
    }
    expect(publicada).toEqual(JSON.parse(readFileSync(RUTA_INSTANTANEA, 'utf8')));
    expect(publicada?.annotations).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    });
  });

  it('B1 recibe del tools/list la misma descripcion y esquema que define el contrato', async () => {
    const { cliente } = await conectar();
    const { tools } = await cliente.listTools();
    const publicada = tools.find((t) => t.name === NOMBRE);
    expect(publicada && descripcionDesdeHerramientaPublicada(publicada)).toEqual({
      nombre: NOMBRE,
      descripcion: DEFINICION_DISPONIBILIDAD_SOPORTE.descripcion,
      esquemaEntrada: DEFINICION_DISPONIBILIDAD_SOPORTE.esquemaEntrada,
    });
  });

  it('B0 no la ve: el puerto en proceso sin el registro de mcp-server sigue con cinco', async () => {
    const { puertoLocal } = montarRegistroDePrueba();
    expect((await puertoLocal.listar()).map((c) => c.nombre)).toEqual(
      DEFINICIONES_HERRAMIENTAS.map((d) => d.nombre),
    );
  });

  it('ningun rol de B2/B3 tiene permiso sobre ella: el filtro por X-Agent-Id la rechaza', () => {
    for (const agente of ['orquestador', 'conocimiento', 'diagnostico']) {
      expect(sinPrivilegio({ 'x-agent-id': agente }, NOMBRE)?.isError).toBe(true);
    }
    expect(sinPrivilegio(undefined, NOMBRE)).toBeNull();
  });

  it('agregar dos veces no falla ni la duplica', async () => {
    const { registro } = montarRegistroDePrueba();
    agregarHerramientasAdicionales(registro);
    agregarHerramientasAdicionales(registro);
    expect(registro.definiciones.filter((d) => d.nombre === NOMBRE)).toHaveLength(1);
  });

  it('el proveedor Nest la registra al iniciar el modulo', () => {
    const { registro } = montarRegistroDePrueba();
    new HerramientasAdicionales(registro).onModuleInit();
    expect(registro.definicion(NOMBRE)).toBe(DEFINICION_DISPONIBILIDAD_SOPORTE);
  });
});

describe('casos de aceptacion por MCP (HU-43)', () => {
  it.each([
    ['1', 'central', '2026-10-15', 'jueves', true, [['07:00', '19:00', 'presencial']], null],
    ['2', 'sur', '2026-10-16', 'viernes', false, [], 'fuera_de_horario'],
    ['3', 'norte', '2026-10-12', 'lunes', false, [], 'festivo'],
    ['4', 'virtual', '2026-10-12', 'lunes', true, [['06:00', '22:00', 'chat']], null],
    ['5', 'norte', '2026-10-20', 'martes', false, [], 'cierre_programado'],
    ['6', 'central', '2026-10-17', 'sábado', true, [['08:00', '12:00', 'presencial']], null],
  ] as const)(
    '%s. %s el %s',
    async (_caso, sede, fecha, dia_semana, disponible, franjas, motivo) => {
      const r = await llamar({ sede, fecha });
      expect(r.isError).toBeFalsy();
      const esperado = {
        sede,
        fecha,
        dia_semana,
        disponible,
        franjas: franjas.map(([inicio, fin, canal]) => ({ inicio, fin, canal })),
        motivo,
      };
      expect(r.structuredContent).toEqual(esperado);
      expect(r.content).toEqual([{ type: 'text', text: JSON.stringify(esperado) }]);
    },
  );

  it('7. sede «oriente»: isError VALIDACION_ENTRADA en español con las sedes validas', async () => {
    const r = await llamar({ sede: 'oriente', fecha: '2026-10-15' });
    expect(r.isError).toBe(true);
    expect((r._meta as Record<string, unknown>)[META_MCP.error]).toEqual({
      codigo: 'VALIDACION_ENTRADA',
      mensaje:
        'Argumentos inválidos para consultar_disponibilidad_soporte: «sede» debe ser uno de: central, norte, sur, virtual.',
    });
  });

  it('8. fecha «2026-13-40»: isError VALIDACION_ENTRADA en español', async () => {
    const r = await llamar({ sede: 'norte', fecha: '2026-13-40' });
    expect(r.isError).toBe(true);
    expect((r._meta as Record<string, unknown>)[META_MCP.error]).toEqual({
      codigo: 'VALIDACION_ENTRADA',
      mensaje:
        'Argumentos inválidos para consultar_disponibilidad_soporte: «fecha» debe ser una fecha que exista, con formato AAAA-MM-DD.',
    });
  });
});

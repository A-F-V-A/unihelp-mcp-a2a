import Ajv from 'ajv';
import { CapacidadesSoporteEnProceso } from './capacidades-soporte-en-proceso';
import {
  CONSULTAR_DISPONIBILIDAD_SOPORTE,
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  consultarDisponibilidadSoporte,
} from './consultar-disponibilidad-soporte';

const contexto = {
  traceId: 'run-soporte',
  conversacionId: 'conv-soporte',
  actor: 'b2-orquestador',
};

async function invocar(argumentos: unknown) {
  return new CapacidadesSoporteEnProceso().invocar(
    CONSULTAR_DISPONIBILIDAD_SOPORTE,
    argumentos,
    contexto,
  );
}

describe('consultar_disponibilidad_soporte: casos de aceptacion (HU-43, decision 60)', () => {
  it('1. central, jueves 2026-10-15: disponible de 07:00 a 19:00 presencial', () => {
    expect(consultarDisponibilidadSoporte('central', '2026-10-15')).toEqual({
      sede: 'central',
      fecha: '2026-10-15',
      dia_semana: 'jueves',
      disponible: true,
      franjas: [{ inicio: '07:00', fin: '19:00', canal: 'presencial' }],
      motivo: null,
    });
  });

  it('2. sur, viernes 2026-10-16: no disponible, fuera_de_horario', () => {
    expect(consultarDisponibilidadSoporte('sur', '2026-10-16')).toEqual({
      sede: 'sur',
      fecha: '2026-10-16',
      dia_semana: 'viernes',
      disponible: false,
      franjas: [],
      motivo: 'fuera_de_horario',
    });
  });

  it('3. norte, festivo 2026-10-12: no disponible, festivo', () => {
    expect(consultarDisponibilidadSoporte('norte', '2026-10-12')).toEqual({
      sede: 'norte',
      fecha: '2026-10-12',
      dia_semana: 'lunes',
      disponible: false,
      franjas: [],
      motivo: 'festivo',
    });
  });

  it('4. virtual, festivo 2026-10-12: disponible de 06:00 a 22:00 por chat', () => {
    expect(consultarDisponibilidadSoporte('virtual', '2026-10-12')).toMatchObject({
      disponible: true,
      franjas: [{ inicio: '06:00', fin: '22:00', canal: 'chat' }],
      motivo: null,
    });
  });

  it('5. norte, 2026-10-20: no disponible, cierre_programado', () => {
    expect(consultarDisponibilidadSoporte('norte', '2026-10-20')).toMatchObject({
      dia_semana: 'martes',
      disponible: false,
      franjas: [],
      motivo: 'cierre_programado',
    });
  });

  it('6. central, sabado 2026-10-17: disponible de 08:00 a 12:00 presencial', () => {
    expect(consultarDisponibilidadSoporte('central', '2026-10-17')).toMatchObject({
      dia_semana: 'sábado',
      disponible: true,
      franjas: [{ inicio: '08:00', fin: '12:00', canal: 'presencial' }],
      motivo: null,
    });
  });

  it('7. sede «oriente»: error de validacion de entrada en español que nombra las sedes validas', async () => {
    const r = await invocar({ sede: 'oriente', fecha: '2026-10-15' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe('VALIDACION_ENTRADA');
    expect(r.error.message).toBe(
      'Argumentos inválidos para consultar_disponibilidad_soporte: «sede» debe ser uno de: central, norte, sur, virtual.',
    );
  });

  it('8. fecha «2026-13-40»: error de validacion de entrada en español', async () => {
    const r = await invocar({ sede: 'central', fecha: '2026-13-40' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe('VALIDACION_ENTRADA');
    expect(r.error.message).toMatch(/la fecha «2026-13-40» no es válida.*AAAA-MM-DD/);
  });
});

describe('consultar_disponibilidad_soporte: bordes y contrato', () => {
  it.each(['2026-02-30', '12/10/2026', '2026-10-1', ''])(
    'rechaza la fecha inexistente o mal formada «%s»',
    async (fecha) => {
      const r = await invocar({ sede: 'norte', fecha });
      expect(r).toMatchObject({ ok: false, error: { codigo: 'VALIDACION_ENTRADA' } });
    },
  );

  it('rechaza argumentos faltantes o sobrantes con el mensaje del validador comun', async () => {
    await expect(invocar({ sede: 'norte' })).resolves.toMatchObject({
      ok: false,
      error: { codigo: 'VALIDACION_ENTRADA', message: expect.stringMatching(/«fecha»/) },
    });
    await expect(
      invocar({ sede: 'norte', fecha: '2026-10-15', hora: '10:00' }),
    ).resolves.toMatchObject({ ok: false, error: { message: expect.stringMatching(/«hora»/) } });
  });

  it('es determinista: la misma entrada da siempre la misma salida', () => {
    const a = consultarDisponibilidadSoporte('sur', '2026-10-14');
    const b = consultarDisponibilidadSoporte('sur', '2026-10-14');
    expect(a).toEqual(b);
    expect(a).toMatchObject({ dia_semana: 'miércoles', disponible: true });
  });

  it('el festivo manda sobre el horario semanal en todas las sedes presenciales', () => {
    for (const sede of ['central', 'norte', 'sur'] as const) {
      expect(consultarDisponibilidadSoporte(sede, '2026-12-08').motivo).toBe('festivo');
    }
  });

  it('domingo en central es fuera_de_horario', () => {
    expect(consultarDisponibilidadSoporte('central', '2026-10-18').motivo).toBe('fuera_de_horario');
  });

  it('la salida por el puerto cumple el esquema de salida publicado y mide su duracion', async () => {
    const r = await invocar({ sede: 'norte', fecha: '2026-10-12' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const validar = new Ajv({ strict: false }).compile(
      DEFINICION_DISPONIBILIDAD_SOPORTE.esquemaSalida,
    );
    expect(validar(r.salida.paraModelo)).toBe(true);
    expect(r.salida.estructurado).toEqual(r.salida.paraModelo);
    expect(r.rttMs).toBeGreaterThanOrEqual(r.durMs);
  });

  it('lista solo la sexta herramienta, con el esquema de entrada del contrato', async () => {
    const lista = await new CapacidadesSoporteEnProceso().listar();
    expect(lista).toEqual([
      {
        nombre: CONSULTAR_DISPONIBILIDAD_SOPORTE,
        descripcion: DEFINICION_DISPONIBILIDAD_SOPORTE.descripcion,
        esquemaEntrada: DEFINICION_DISPONIBILIDAD_SOPORTE.esquemaEntrada,
      },
    ]);
  });
});

import {
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  EjecutorCapacidad,
  NOMBRE_DISPONIBILIDAD_SOPORTE,
  type ResultadoCapacidad,
  ValidadorArgumentos,
} from '@unihelp/herramientas';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  ConsultarDisponibilidadSoporteCapacidad,
  calcularDisponibilidadSoporte,
} from './consultar-disponibilidad-soporte.capacidad';

const contexto = { traceId: 't-disp', conversacionId: 'c-disp', actor: 'b3-orquestador' };

/** Invoca por la misma puerta que `mcp-server`: validacion por esquema y manejador. */
function montar() {
  const validador = new ValidadorArgumentos([DEFINICION_DISPONIBILIDAD_SOPORTE]);
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const ejecutor = new EjecutorCapacidad(validador, auditoria, 20);
  const capacidad = new ConsultarDisponibilidadSoporteCapacidad();
  const invocar = (argumentos: unknown): Promise<ResultadoCapacidad> =>
    ejecutor.ejecutar(NOMBRE_DISPONIBILIDAD_SOPORTE, argumentos, contexto, (a) =>
      capacidad.ejecutar(a),
    );
  return { invocar, auditoria };
}

async function salida(sede: string, fecha: string): Promise<unknown> {
  const r = await montar().invocar({ sede, fecha });
  if (!r.ok) {
    throw new Error(r.error.message);
  }
  return r.salida.paraModelo;
}

describe('consultar_disponibilidad_soporte: casos de aceptacion (HU-43)', () => {
  it('1. central, jueves 2026-10-15: disponible 07:00-19:00 presencial', async () => {
    expect(await salida('central', '2026-10-15')).toEqual({
      sede: 'central',
      fecha: '2026-10-15',
      dia_semana: 'jueves',
      disponible: true,
      franjas: [{ inicio: '07:00', fin: '19:00', canal: 'presencial' }],
      motivo: null,
    });
  });

  it('2. sur, viernes 2026-10-16: no disponible, fuera_de_horario', async () => {
    expect(await salida('sur', '2026-10-16')).toEqual({
      sede: 'sur',
      fecha: '2026-10-16',
      dia_semana: 'viernes',
      disponible: false,
      franjas: [],
      motivo: 'fuera_de_horario',
    });
  });

  it('3. norte, festivo 2026-10-12: no disponible, festivo', async () => {
    expect(await salida('norte', '2026-10-12')).toEqual({
      sede: 'norte',
      fecha: '2026-10-12',
      dia_semana: 'lunes',
      disponible: false,
      franjas: [],
      motivo: 'festivo',
    });
  });

  it('4. virtual, festivo 2026-10-12: disponible 06:00-22:00 por chat', async () => {
    expect(await salida('virtual', '2026-10-12')).toEqual({
      sede: 'virtual',
      fecha: '2026-10-12',
      dia_semana: 'lunes',
      disponible: true,
      franjas: [{ inicio: '06:00', fin: '22:00', canal: 'chat' }],
      motivo: null,
    });
  });

  it('5. norte, 2026-10-20: no disponible, cierre_programado', async () => {
    expect(await salida('norte', '2026-10-20')).toMatchObject({
      dia_semana: 'martes',
      disponible: false,
      franjas: [],
      motivo: 'cierre_programado',
    });
  });

  it('6. central, sabado 2026-10-17: disponible 08:00-12:00 presencial', async () => {
    expect(await salida('central', '2026-10-17')).toMatchObject({
      dia_semana: 'sábado',
      disponible: true,
      franjas: [{ inicio: '08:00', fin: '12:00', canal: 'presencial' }],
      motivo: null,
    });
  });

  it('7. sede «oriente»: error de validacion en español que nombra las sedes validas', async () => {
    const r = await montar().invocar({ sede: 'oriente', fecha: '2026-10-15' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe('VALIDACION_ENTRADA');
      expect(r.error.message).toContain('Argumentos inválidos');
      expect(r.error.message).toContain('central, norte, sur, virtual');
    }
  });

  it('8. fecha «2026-13-40»: error de validacion en español', async () => {
    const r = await montar().invocar({ sede: 'central', fecha: '2026-13-40' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe('VALIDACION_ENTRADA');
      expect(r.error.message).toContain('Argumentos inválidos');
      expect(r.error.message).toContain('«fecha»');
    }
  });
});

describe('consultar_disponibilidad_soporte: reglas y contrato', () => {
  it('es determinista: la misma entrada da siempre la misma salida', async () => {
    expect(await salida('norte', '2026-11-16')).toEqual(await salida('norte', '2026-11-16'));
  });

  it('domingo en una sede presencial es fuera_de_horario; en virtual atiende', () => {
    expect(calcularDisponibilidadSoporte('central', '2026-10-18')).toMatchObject({
      dia_semana: 'domingo',
      disponible: false,
      motivo: 'fuera_de_horario',
    });
    expect(calcularDisponibilidadSoporte('virtual', '2026-10-18').disponible).toBe(true);
  });

  it('una fecha con formato valido pero inexistente se rechaza tambien sin pasar por el esquema', () => {
    expect(() => calcularDisponibilidadSoporte('central', '2026-02-30')).toThrow(/AAAA-MM-DD/);
    expect(() => calcularDisponibilidadSoporte('oriente', '2026-10-15')).toThrow(
      /central, norte, sur, virtual/,
    );
  });

  it('el esquema de entrada rechaza fechas inexistentes y argumentos de mas', async () => {
    const { invocar } = montar();
    expect((await invocar({ sede: 'sur', fecha: '2026-02-30' })).ok).toBe(false);
    expect((await invocar({ sede: 'sur', fecha: '12/10/2026' })).ok).toBe(false);
    expect((await invocar({ sede: 'sur' })).ok).toBe(false);
    expect((await invocar({ sede: 'sur', fecha: '2026-10-15', hora: '10:00' })).ok).toBe(false);
  });

  it('toda salida cumple el esquema de salida publicado', async () => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    const validar = ajv.compile(DEFINICION_DISPONIBILIDAD_SOPORTE.esquemaSalida);
    for (const [sede, fecha] of [
      ['central', '2026-10-15'],
      ['sur', '2026-10-16'],
      ['norte', '2026-10-12'],
      ['virtual', '2026-10-12'],
      ['norte', '2026-10-20'],
      ['central', '2026-10-17'],
    ]) {
      expect(validar(await salida(sede as string, fecha as string))).toBe(true);
    }
  });

  it('es de solo lectura: anotaciones de lectura e idempotencia', () => {
    expect(DEFINICION_DISPONIBILIDAD_SOPORTE.anotaciones).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(DEFINICION_DISPONIBILIDAD_SOPORTE.tipo).toBe('lectura');
  });
});

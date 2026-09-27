import {
  type ContextoInvocacion,
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  EjecutorCapacidad,
  ValidadorArgumentos,
} from '@unihelp/herramientas';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ConsultarDisponibilidadSoporteCapacidad } from './consultar-disponibilidad-soporte.capacidad';

const contexto: ContextoInvocacion = { traceId: 't-sop', conversacionId: 'c1', actor: 'prueba' };

/** Invoca la capacidad por la puerta del receptor: validacion, ejecucion y auditoria (HU-22). */
function montar() {
  const validador = new ValidadorArgumentos();
  validador.registrar(DEFINICION_DISPONIBILIDAD_SOPORTE);
  const ejecutor = new EjecutorCapacidad(validador, { registrar: async () => undefined }, 50);
  const capacidad = new ConsultarDisponibilidadSoporteCapacidad();
  return (argumentos: unknown) =>
    ejecutor.ejecutar(capacidad.nombre, argumentos, contexto, (a) => capacidad.ejecutar(a));
}

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validarSalida = ajv.compile(DEFINICION_DISPONIBILIDAD_SOPORTE.esquemaSalida);

async function consultar(sede: string, fecha: string) {
  const r = await montar()({ sede, fecha });
  if (!r.ok) {
    throw new Error(r.error.message);
  }
  const salida = r.salida.paraModelo;
  expect(validarSalida(JSON.parse(JSON.stringify(salida)))).toBe(true);
  return salida;
}

describe('consultar_disponibilidad_soporte (HU-43)', () => {
  it('1. central un jueves: disponible de 07:00 a 19:00 presencial', async () => {
    expect(await consultar('central', '2026-10-15')).toEqual({
      sede: 'central',
      fecha: '2026-10-15',
      dia_semana: 'jueves',
      disponible: true,
      franjas: [{ inicio: '07:00', fin: '19:00', canal: 'presencial' }],
      motivo: null,
    });
  });

  it('2. sur un viernes: no disponible, fuera_de_horario', async () => {
    expect(await consultar('sur', '2026-10-16')).toEqual({
      sede: 'sur',
      fecha: '2026-10-16',
      dia_semana: 'viernes',
      disponible: false,
      franjas: [],
      motivo: 'fuera_de_horario',
    });
  });

  it('3. norte un festivo: no disponible, festivo', async () => {
    expect(await consultar('norte', '2026-10-12')).toEqual({
      sede: 'norte',
      fecha: '2026-10-12',
      dia_semana: 'lunes',
      disponible: false,
      franjas: [],
      motivo: 'festivo',
    });
  });

  it('4. virtual en festivo: disponible de 06:00 a 22:00 por chat', async () => {
    expect(await consultar('virtual', '2026-10-12')).toMatchObject({
      disponible: true,
      franjas: [{ inicio: '06:00', fin: '22:00', canal: 'chat' }],
      motivo: null,
    });
  });

  it('5. norte con cierre programado: no disponible, cierre_programado', async () => {
    expect(await consultar('norte', '2026-10-20')).toMatchObject({
      dia_semana: 'martes',
      disponible: false,
      franjas: [],
      motivo: 'cierre_programado',
    });
  });

  it('6. central un sabado: disponible de 08:00 a 12:00 presencial', async () => {
    expect(await consultar('central', '2026-10-17')).toMatchObject({
      dia_semana: 'sábado',
      disponible: true,
      franjas: [{ inicio: '08:00', fin: '12:00', canal: 'presencial' }],
      motivo: null,
    });
  });

  it('7. una sede fuera del catalogo es error de validacion en español que nombra las validas', async () => {
    const r = await montar()({ sede: 'oriente', fecha: '2026-10-15' });
    expect(r).toMatchObject({ ok: false, error: { codigo: 'VALIDACION_ENTRADA' } });
    if (!r.ok) {
      expect(r.error.message).toContain('debe ser uno de: central, norte, sur, virtual');
    }
  });

  it('8. una fecha inexistente es error de validacion en español', async () => {
    for (const fecha of ['2026-13-40', '2026-02-30', '12/10/2026']) {
      const r = await montar()({ sede: 'central', fecha });
      expect(r).toMatchObject({ ok: false, error: { codigo: 'VALIDACION_ENTRADA' } });
      if (!r.ok) {
        expect(r.error.message).toContain('fecha existente con formato AAAA-MM-DD');
      }
    }
  });

  it('la capacidad rechaza en español una sede o fecha invalidas aun sin validador', async () => {
    const capacidad = new ConsultarDisponibilidadSoporteCapacidad();
    await expect(capacidad.ejecutar({ sede: 'oriente', fecha: '2026-10-15' })).rejects.toThrow(
      'Sedes válidas: central, norte, sur, virtual',
    );
    await expect(capacidad.ejecutar({ sede: 'norte', fecha: '2026-13-40' })).rejects.toThrow(
      'no es válida',
    );
  });

  it('es determinista: la misma entrada da la misma salida', async () => {
    expect(await consultar('sur', '2026-10-14')).toEqual(await consultar('sur', '2026-10-14'));
  });
});

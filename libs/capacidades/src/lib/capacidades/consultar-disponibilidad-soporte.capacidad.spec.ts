import {
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  ErrorHerramienta,
  ValidadorArgumentos,
} from '@unihelp/herramientas';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  ConsultarDisponibilidadSoporteCapacidad,
  consultarDisponibilidadSoporte,
} from './consultar-disponibilidad-soporte.capacidad';

/** Casos de aceptacion 1 a 8 de la sexta herramienta (HU-43), sobre la regla pura. */
describe('consultar_disponibilidad_soporte (HU-43)', () => {
  it('1. central el jueves 2026-10-15: disponible de 07:00 a 19:00 presencial', () => {
    expect(consultarDisponibilidadSoporte('central', '2026-10-15')).toEqual({
      sede: 'central',
      fecha: '2026-10-15',
      dia_semana: 'jueves',
      disponible: true,
      franjas: [{ inicio: '07:00', fin: '19:00', canal: 'presencial' }],
      motivo: null,
    });
  });

  it('2. sur el viernes 2026-10-16: no disponible, fuera_de_horario', () => {
    expect(consultarDisponibilidadSoporte('sur', '2026-10-16')).toEqual({
      sede: 'sur',
      fecha: '2026-10-16',
      dia_semana: 'viernes',
      disponible: false,
      franjas: [],
      motivo: 'fuera_de_horario',
    });
  });

  it('3. norte el festivo 2026-10-12: no disponible, festivo', () => {
    expect(consultarDisponibilidadSoporte('norte', '2026-10-12')).toEqual({
      sede: 'norte',
      fecha: '2026-10-12',
      dia_semana: 'lunes',
      disponible: false,
      franjas: [],
      motivo: 'festivo',
    });
  });

  it('4. virtual el festivo 2026-10-12: atiende de 06:00 a 22:00 por chat', () => {
    expect(consultarDisponibilidadSoporte('virtual', '2026-10-12')).toMatchObject({
      disponible: true,
      franjas: [{ inicio: '06:00', fin: '22:00', canal: 'chat' }],
      motivo: null,
    });
  });

  it('5. norte el 2026-10-20: no disponible, cierre_programado', () => {
    expect(consultarDisponibilidadSoporte('norte', '2026-10-20')).toMatchObject({
      dia_semana: 'martes',
      disponible: false,
      franjas: [],
      motivo: 'cierre_programado',
    });
  });

  it('6. central el sabado 2026-10-17: disponible de 08:00 a 12:00 presencial', () => {
    expect(consultarDisponibilidadSoporte('central', '2026-10-17')).toMatchObject({
      dia_semana: 'sábado',
      disponible: true,
      franjas: [{ inicio: '08:00', fin: '12:00', canal: 'presencial' }],
      motivo: null,
    });
  });

  it('7. una sede fuera del catalogo es VALIDACION_ENTRADA en español y nombra las validas', () => {
    const validador = new ValidadorArgumentos([DEFINICION_DISPONIBILIDAD_SOPORTE]);
    const r = validador.validar('consultar_disponibilidad_soporte', {
      sede: 'oriente',
      fecha: '2026-10-15',
    });
    expect(r).toEqual({
      valido: false,
      mensaje:
        'Argumentos inválidos para consultar_disponibilidad_soporte: «sede» debe ser uno de: central, norte, sur, virtual.',
    });
    expect(() => consultarDisponibilidadSoporte('oriente', '2026-10-15')).toThrow(
      new ErrorHerramienta(
        'VALIDACION_ENTRADA',
        'La sede «oriente» no existe. Sedes válidas: central, norte, sur, virtual.',
      ),
    );
  });

  it.each(['2026-13-40', '2026-02-30', '15/10/2026', '2026-1-5'])(
    '8. la fecha «%s» es VALIDACION_ENTRADA en español',
    (fecha) => {
      const validador = new ValidadorArgumentos([DEFINICION_DISPONIBILIDAD_SOPORTE]);
      expect(
        validador.validar('consultar_disponibilidad_soporte', { sede: 'norte', fecha }),
      ).toEqual({
        valido: false,
        mensaje:
          'Argumentos inválidos para consultar_disponibilidad_soporte: «fecha» debe ser una fecha que exista, con formato AAAA-MM-DD.',
      });
      let error: unknown;
      try {
        consultarDisponibilidadSoporte('norte', fecha);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ErrorHerramienta);
      expect((error as ErrorHerramienta).codigo).toBe('VALIDACION_ENTRADA');
      expect((error as ErrorHerramienta).message).toContain('AAAA-MM-DD');
    },
  );

  it('un festivo que cae en un dia sin horario se informa como festivo (sur, viernes 25 de diciembre)', () => {
    expect(consultarDisponibilidadSoporte('sur', '2026-12-25')).toMatchObject({
      dia_semana: 'viernes',
      motivo: 'festivo',
    });
  });

  it('el domingo no hay atencion presencial en ninguna sede', () => {
    for (const sede of ['central', 'norte', 'sur']) {
      expect(consultarDisponibilidadSoporte(sede, '2026-10-18')).toMatchObject({
        dia_semana: 'domingo',
        disponible: false,
        motivo: 'fuera_de_horario',
      });
    }
  });

  it('es determinista: la misma entrada da la misma salida', () => {
    expect(consultarDisponibilidadSoporte('norte', '2026-10-13')).toEqual(
      consultarDisponibilidadSoporte('norte', '2026-10-13'),
    );
  });

  it('la salida de la capacidad cumple el esquemaSalida publicado', async () => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validar = ajv.compile(DEFINICION_DISPONIBILIDAD_SOPORTE.esquemaSalida);
    const capacidad = new ConsultarDisponibilidadSoporteCapacidad();
    for (const [sede, fecha] of [
      ['central', '2026-10-15'],
      ['norte', '2026-10-12'],
      ['virtual', '2026-10-18'],
    ]) {
      const salida = await capacidad.ejecutar({ sede, fecha });
      validar(JSON.parse(JSON.stringify(salida.paraModelo)));
      expect(validar.errors ?? []).toEqual([]);
    }
    expect(capacidad.nombre).toBe(DEFINICION_DISPONIBILIDAD_SOPORTE.nombre);
  });
});

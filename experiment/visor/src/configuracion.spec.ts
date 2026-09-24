import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  ErrorConfiguracionVisor,
  RUTA_CONFIG_POR_DEFECTO,
  interpretarConfiguracion,
  nombreCorrida,
} from './configuracion';

describe('configuracion del visor', () => {
  const documento = (): unknown => parse(readFileSync(RUTA_CONFIG_POR_DEFECTO, 'utf8'));

  it('lee visor.config.yaml con los valores que documenta', () => {
    const configuracion = interpretarConfiguracion(documento(), {});

    expect(configuracion.arquitectura).toBe('B0');
    expect(configuracion.tareas).toBeNull();
    expect(configuracion.persona.confirmacion).toBe('texto');
    expect(configuracion.persona.tecleoMs).toEqual([35, 110]);
    expect(configuracion.entorno.restablecer).toBe(true);
    expect(configuracion.medicion.fallarSiRepruebaCompuerta).toBe(false);
    expect(configuracion.salidas.directorio.replace(/\\/g, '/')).toMatch(
      /experiment\/visor\/salidas$/,
    );
  });

  it('las variables VISOR_* pisan el archivo', () => {
    const configuracion = interpretarConfiguracion(documento(), {
      VISOR_TAREAS: 'T-COM-001, T-ADV-*',
      VISOR_CONFIRMACION: 'boton',
      VISOR_TECLEO_MS: '10,20',
      VISOR_REPETICIONES: '3',
      VISOR_RESTABLECER: 'false',
      VISOR_PANEL: 'false',
      VISOR_BACKEND: 'http://localhost:3002/',
      VISOR_ARQUITECTURA: 'B2',
    });

    expect(configuracion.tareas).toEqual(['T-COM-001', 'T-ADV-*']);
    expect(configuracion.persona.confirmacion).toBe('boton');
    expect(configuracion.persona.tecleoMs).toEqual([10, 20]);
    expect(configuracion.repeticiones).toBe(3);
    expect(configuracion.entorno.restablecer).toBe(false);
    expect(configuracion.panel.visible).toBe(false);
    expect(configuracion.backend).toBe('http://localhost:3002');
    expect(configuracion.arquitectura).toBe('B2');
  });

  it('un valor invalido detiene el visor en vez de suponer otro', () => {
    expect(() =>
      interpretarConfiguracion({ ...(documento() as object), arquitectura: 'B9' }, {}),
    ).toThrow(ErrorConfiguracionVisor);
    expect(() => interpretarConfiguracion(documento(), { VISOR_CONFIRMACION: 'voz' })).toThrow(
      /persona.confirmacion/,
    );
    expect(() => interpretarConfiguracion(documento(), { VISOR_TECLEO_MS: '50,10' })).toThrow(
      /persona.tecleo_ms/,
    );
    expect(() =>
      interpretarConfiguracion(
        { ...(documento() as object), persona: { errores_de_tecleo: 3 } },
        {},
      ),
    ).toThrow(/probabilidad/);
  });

  it('el nombre de la corrida sale del entorno o de la marca de tiempo', () => {
    expect(nombreCorrida({ VISOR_NOMBRE: 'mi corrida/1' })).toBe('mi_corrida_1');
    expect(nombreCorrida({}, new Date('2026-09-23T10:20:30.123Z'))).toBe('visor-20260923T102030Z');
  });
});

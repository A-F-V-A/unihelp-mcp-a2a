import { ConfiguracionInvalidaError } from '../dominio/errores';
import {
  perfilPermiteRestablecer,
  resolverConfiguracionConocimiento,
  UMBRAL_RELEVANCIA_POR_DEFECTO,
} from './configuracion';

describe('perfilPermiteRestablecer (HU-36)', () => {
  it.each([
    [{}, false],
    [{ NODE_ENV: 'production' }, false],
    [{ NODE_ENV: 'development' }, false],
    [{ NODE_ENV: 'test' }, true],
    [{ UNIHELP_PERFIL: 'experimento' }, true],
    [{ UNIHELP_PERFIL: 'experimento', NODE_ENV: 'production' }, true],
    [{ UNIHELP_PERFIL: 'produccion', NODE_ENV: 'test' }, false],
    [{ UNIHELP_PERFIL: 'Experimento' }, false],
  ])('%j -> %s', (entorno, esperado) => {
    expect(perfilPermiteRestablecer(entorno)).toBe(esperado);
  });
});

describe('resolverConfiguracionConocimiento', () => {
  const url = 'postgres://u:p@localhost:5432/db';

  it('exige la URL de la base', () => {
    expect(() => resolverConfiguracionConocimiento({}, {})).toThrow(ConfiguracionInvalidaError);
  });

  it('usa el umbral por defecto si no se configura', () => {
    expect(
      resolverConfiguracionConocimiento({}, { CONOCIMIENTO_DATABASE_URL: url }).umbralRelevancia,
    ).toBe(UMBRAL_RELEVANCIA_POR_DEFECTO);
  });

  it('lee el umbral del entorno y lo valida', () => {
    const entorno = { CONOCIMIENTO_DATABASE_URL: url };
    expect(
      resolverConfiguracionConocimiento({}, { ...entorno, CONOCIMIENTO_UMBRAL_RELEVANCIA: '0.12' })
        .umbralRelevancia,
    ).toBe(0.12);
    expect(() =>
      resolverConfiguracionConocimiento({}, { ...entorno, CONOCIMIENTO_UMBRAL_RELEVANCIA: 'alto' }),
    ).toThrow(ConfiguracionInvalidaError);
    expect(() =>
      resolverConfiguracionConocimiento({}, { ...entorno, CONOCIMIENTO_UMBRAL_RELEVANCIA: '1' }),
    ).toThrow(ConfiguracionInvalidaError);
  });

  it('las opciones por codigo ganan al entorno, pero nunca el perfil', () => {
    const configuracion = resolverConfiguracionConocimiento(
      { urlBaseDatos: url, umbralRelevancia: 0.2 },
      { CONOCIMIENTO_DATABASE_URL: 'postgres://otra', CONOCIMIENTO_UMBRAL_RELEVANCIA: '0.9' },
    );
    expect(configuracion).toEqual({
      urlBaseDatos: url,
      umbralRelevancia: 0.2,
      restablecimientoPermitido: false,
    });
  });
});

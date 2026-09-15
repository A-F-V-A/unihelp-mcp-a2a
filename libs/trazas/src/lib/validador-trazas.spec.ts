import { construirCaso, leerCasos, leerTrazaValida } from './casos-compartidos';
import { ValidadorTrazas } from './validador-trazas';

describe('ValidadorTrazas', () => {
  const validador = new ValidadorTrazas();

  it.each(leerCasos().map((caso) => [caso.nombre, caso] as const))(
    'caso compartido con Python: %s',
    (_nombre, caso) => {
      expect(validador.validar(construirCaso(caso)).valida).toBe(caso.valida);
    },
  );

  it('rechaza una traza sin consumo de tokens y dice donde falla', () => {
    const traza = leerTrazaValida();
    (traza['usage'] as Record<string, unknown>)['input_tokens'] = 0;

    const resultado = validador.validar(traza);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida) {
      expect(resultado.errores).toContainEqual(
        expect.objectContaining({ ruta: '/usage/input_tokens', palabraClave: 'minimum' }),
      );
    }
  });

  it('reporta todos los errores juntos, no solo el primero', () => {
    const traza = leerTrazaValida();
    delete traza['usage'];
    delete traza['a2a'];

    const resultado = validador.validar(traza);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida) {
      expect(resultado.errores.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('rechaza valores que no son objetos', () => {
    expect(validador.validar(null).valida).toBe(false);
    expect(validador.validar('traza').valida).toBe(false);
  });
});

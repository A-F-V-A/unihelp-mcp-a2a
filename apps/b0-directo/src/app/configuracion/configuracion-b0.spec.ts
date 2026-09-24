import { ConfiguracionB0InvalidaError, leerConfiguracionB0 } from './configuracion-b0';

const base = {
  UNIHELP_MODELO_PROVEEDOR: 'openai',
  UNIHELP_MODELO_ID: 'gpt-5.4-mini-2026-03-17',
  UNIHELP_MODO_LLM: 'live',
  OPENAI_API_KEY: 'clave-de-prueba',
};

describe('leerConfiguracionB0', () => {
  it('aplica los valores por defecto de docs/07 y RNF-04', () => {
    const c = leerConfiguracionB0(base);
    expect(c.modelo).toMatchObject({
      temperatura: 0.2,
      topP: 1,
      maxTokens: 2048,
      esfuerzoRazonamiento: 'none',
    });
    expect(c.limites).toEqual({ tiempoMs: 120_000, turnos: 8, llamadasHerramienta: 20 });
  });

  it('falla al arrancar si falta el modelo o el modo', () => {
    expect(() => leerConfiguracionB0({ ...base, UNIHELP_MODELO_ID: '' })).toThrow(
      ConfiguracionB0InvalidaError,
    );
    expect(() => leerConfiguracionB0({ ...base, UNIHELP_MODO_LLM: undefined })).toThrow(
      ConfiguracionB0InvalidaError,
    );
  });

  it('en replay no exige la clave pero si el directorio de casetes (HU-39, HU-44)', () => {
    const sinClave = { ...base, OPENAI_API_KEY: undefined, UNIHELP_MODO_LLM: 'replay' };
    expect(() => leerConfiguracionB0(sinClave)).toThrow(/UNIHELP_DIRECTORIO_CASETES/);
    const c = leerConfiguracionB0({ ...sinClave, UNIHELP_DIRECTORIO_CASETES: 'casetes' });
    expect(c.claveApi).toBeNull();
  });

  it('rechaza un limite no positivo', () => {
    expect(() => leerConfiguracionB0({ ...base, UNIHELP_LIMITE_TIEMPO_MS: '0' })).toThrow(
      ConfiguracionB0InvalidaError,
    );
  });
});

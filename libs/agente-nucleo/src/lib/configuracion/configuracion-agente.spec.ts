import { ConfiguracionAgenteInvalidaError, leerConfiguracionAgente } from './configuracion-agente';

const base = {
  UNIHELP_MODELO_PROVEEDOR: 'openai',
  UNIHELP_MODELO_ID: 'gpt-5.4-mini-2026-03-17',
  UNIHELP_MODO_LLM: 'live',
  OPENAI_API_KEY: 'clave-de-prueba',
};

describe('leerConfiguracionAgente', () => {
  it('aplica los valores por defecto de docs/07 y RNF-04', () => {
    const c = leerConfiguracionAgente(base);
    expect(c.modelo).toMatchObject({
      proveedor: 'openai',
      urlBase: null,
      temperatura: 0.2,
      topP: 1,
      maxTokens: 2048,
      esfuerzoRazonamiento: 'none',
    });
    expect(c.limites).toEqual({ tiempoMs: 120_000, turnos: 8, llamadasHerramienta: 20 });
  });

  it('falla al arrancar si falta el modelo o el modo', () => {
    expect(() => leerConfiguracionAgente({ ...base, UNIHELP_MODELO_ID: '' })).toThrow(
      ConfiguracionAgenteInvalidaError,
    );
    expect(() => leerConfiguracionAgente({ ...base, UNIHELP_MODO_LLM: undefined })).toThrow(
      ConfiguracionAgenteInvalidaError,
    );
  });

  it('en replay no exige la clave pero si el directorio de casetes (HU-39, HU-44)', () => {
    const sinClave = { ...base, OPENAI_API_KEY: undefined, UNIHELP_MODO_LLM: 'replay' };
    expect(() => leerConfiguracionAgente(sinClave)).toThrow(/UNIHELP_DIRECTORIO_CASETES/);
    const c = leerConfiguracionAgente({ ...sinClave, UNIHELP_DIRECTORIO_CASETES: 'casetes' });
    expect(c.claveApi).toBeNull();
  });

  it('rechaza un limite no positivo', () => {
    expect(() => leerConfiguracionAgente({ ...base, UNIHELP_LIMITE_TIEMPO_MS: '0' })).toThrow(
      ConfiguracionAgenteInvalidaError,
    );
  });

  describe('proveedor Gemini por su endpoint compatible con OpenAI (decision 48)', () => {
    const gemini = {
      UNIHELP_MODELO_PROVEEDOR: 'gemini',
      UNIHELP_MODELO_ID: 'gemini-2.5-flash',
      UNIHELP_MODO_LLM: 'live',
      GEMINI_API_KEY: 'AIza-prueba',
    };

    it('usa GEMINI_API_KEY y la URL de Google AI Studio por defecto', () => {
      const c = leerConfiguracionAgente(gemini);
      expect(c.modelo.proveedor).toBe('gemini');
      expect(c.modelo.urlBase).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
      expect(c.claveApi).toBe('AIza-prueba');
    });

    it('sin GEMINI_API_KEY no arranca, aunque haya OPENAI_API_KEY', () => {
      expect(() =>
        leerConfiguracionAgente({ ...gemini, GEMINI_API_KEY: '', OPENAI_API_KEY: 'sk-x' }),
      ).toThrow(/GEMINI_API_KEY/);
    });
  });

  describe('proveedor local por Ollama (decision 46)', () => {
    const ollama = {
      UNIHELP_MODELO_PROVEEDOR: 'ollama',
      UNIHELP_MODELO_ID: 'unihelp-qwen2.5:7b-instruct-q4_K_M-ctx16k',
      UNIHELP_MODO_LLM: 'live',
    };

    it('no exige clave y apunta a la URL local por defecto', () => {
      const c = leerConfiguracionAgente(ollama);
      expect(c.modelo.proveedor).toBe('ollama');
      expect(c.modelo.urlBase).toBe('http://localhost:11434/v1');
      // El SDK exige un valor no vacio; Ollama lo ignora.
      expect(c.claveApi).toBe('ollama');
    });

    it('admite otra URL base y la valida', () => {
      const c = leerConfiguracionAgente({
        ...ollama,
        UNIHELP_MODELO_URL_BASE: 'http://127.0.0.1:11500/v1',
      });
      expect(c.modelo.urlBase).toBe('http://127.0.0.1:11500/v1');
      expect(() =>
        leerConfiguracionAgente({ ...ollama, UNIHELP_MODELO_URL_BASE: 'no-es-una-url' }),
      ).toThrow(ConfiguracionAgenteInvalidaError);
    });

    it('en replay sigue sin clave, igual que con OpenAI', () => {
      const c = leerConfiguracionAgente({
        ...ollama,
        UNIHELP_MODO_LLM: 'replay',
        UNIHELP_DIRECTORIO_CASETES: 'casetes',
      });
      expect(c.claveApi).toBeNull();
    });

    it('rechaza un proveedor desconocido', () => {
      expect(() =>
        leerConfiguracionAgente({ ...base, UNIHELP_MODELO_PROVEEDOR: 'anthropic' }),
      ).toThrow(/openai, ollama, gemini/);
    });
  });
});

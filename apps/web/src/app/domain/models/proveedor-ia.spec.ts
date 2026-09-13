import {
  CONFIGURACION_MODELO_POR_DEFECTO,
  type ConfiguracionModeloIA,
  enmascararToken,
  modeloIAConfigurado,
  normalizarConfiguracionModeloIA,
  validarConfiguracionModeloIA,
} from './proveedor-ia';

const base = (parcial: Partial<ConfiguracionModeloIA> = {}): ConfiguracionModeloIA => ({
  ...CONFIGURACION_MODELO_POR_DEFECTO,
  ...parcial,
});

describe('configuracion de modelo de IA', () => {
  it('normaliza datos guardados incompletos o corruptos', () => {
    expect(normalizarConfiguracionModeloIA(null)).toEqual(CONFIGURACION_MODELO_POR_DEFECTO);
    expect(normalizarConfiguracionModeloIA('basura')).toEqual(CONFIGURACION_MODELO_POR_DEFECTO);
    expect(
      normalizarConfiguracionModeloIA({
        proveedor: 'gemini',
        token: '  abc  ',
        modelo: 'inventado',
      }),
    ).toEqual({ proveedor: 'gemini', modelo: 'inventado', token: '  abc  ', urlAgenteLocal: '' });
    expect(normalizarConfiguracionModeloIA({ proveedor: 'no-existe' }).proveedor).toBe('chatgpt');
  });

  it('exige clave de API para los proveedores en la nube', () => {
    const sinToken = validarConfiguracionModeloIA(base({ proveedor: 'chatgpt', token: '' }));
    expect(sinToken.valido).toBe(false);
    expect(sinToken.valido === false && sinToken.errores.token).toMatch(/clave de API/);
    expect(sinToken.valido === false && sinToken.errores.urlAgenteLocal).toBeUndefined();

    const conToken = validarConfiguracionModeloIA(base({ proveedor: 'gemini', token: 'sk-123' }));
    expect(conToken).toEqual({
      valido: true,
      configuracion: { proveedor: 'gemini', modelo: '', token: 'sk-123', urlAgenteLocal: '' },
    });
  });

  it('el agente local ademas exige una URL con http:// o https://', () => {
    const sinNada = validarConfiguracionModeloIA(base({ proveedor: 'local' }));
    expect(sinNada.valido).toBe(false);
    expect(sinNada.valido === false && Object.keys(sinNada.errores)).toEqual([
      'token',
      'urlAgenteLocal',
    ]);

    const urlInvalida = validarConfiguracionModeloIA(
      base({ proveedor: 'local', token: 'tok', urlAgenteLocal: 'agente.local' }),
    );
    expect(urlInvalida.valido === false && urlInvalida.errores.urlAgenteLocal).toMatch(/http/);

    const completo = validarConfiguracionModeloIA(
      base({ proveedor: 'local', token: 'tok', urlAgenteLocal: 'http://localhost:9000' }),
    );
    expect(completo).toEqual({
      valido: true,
      configuracion: {
        proveedor: 'local',
        modelo: '',
        token: 'tok',
        urlAgenteLocal: 'http://localhost:9000',
      },
    });
  });

  it('modeloIAConfigurado refleja si la validacion pasa', () => {
    expect(modeloIAConfigurado(base({ token: '' }))).toBe(false);
    expect(modeloIAConfigurado(base({ token: 'abc' }))).toBe(true);
  });

  it('enmascara el token dejando solo los ultimos caracteres visibles', () => {
    expect(enmascararToken('')).toBe('');
    expect(enmascararToken('abcd')).toBe('••••');
    expect(enmascararToken('sk-proj-1234567890')).toBe('••••••••7890');
  });
});

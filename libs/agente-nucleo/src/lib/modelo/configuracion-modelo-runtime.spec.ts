import type { ConfiguracionAgente } from '../configuracion/configuracion-agente';
import { ErrorApi } from '../http/error-api';
import { ConfiguracionModeloRuntime } from './configuracion-modelo-runtime';

function configuracion(parcial: Partial<ConfiguracionAgente> = {}): ConfiguracionAgente {
  return {
    modelo: {
      proveedor: 'openai',
      id: 'modelo-oficial',
      temperatura: 0.2,
      topP: 1,
      maxTokens: 2048,
      esfuerzoRazonamiento: 'none',
    },
    modelosPermitidos: ['modelo-oficial', 'modelo-alterno'],
    claveApi: 'clave',
    modoLlm: 'live',
    directorioCasetes: null,
    limites: { tiempoMs: 120_000, turnos: 8, llamadasHerramienta: 20 },
    ...parcial,
  };
}

describe('ConfiguracionModeloRuntime (decision 27)', () => {
  it('parte del modelo configurado y solo ofrece OpenAI como disponible', () => {
    const estado = new ConfiguracionModeloRuntime(configuracion()).estado();

    expect(estado.seleccion).toEqual({ proveedor: 'chatgpt', modelo: 'modelo-oficial' });
    expect(estado.claveConfigurada).toBe(true);
    const disponibles = estado.proveedores.filter((p) => p.disponible).map((p) => p.id);
    expect(disponibles).toEqual(['chatgpt']);
    expect(estado.proveedores.find((p) => p.id === 'claude')?.motivoNoDisponible).toMatch(
      /todavía no integra/,
    );
  });

  it('acepta un modelo habilitado y lo usa fuera del experimento', () => {
    const runtime = new ConfiguracionModeloRuntime(configuracion());

    runtime.seleccionar({ proveedor: 'chatgpt', modelo: 'modelo-alterno' });

    expect(runtime.modeloVigente(false)).toBe('modelo-alterno');
  });

  it('una corrida del experimento ignora la eleccion de la interfaz (RNF-01)', () => {
    const runtime = new ConfiguracionModeloRuntime(configuracion());
    runtime.seleccionar({ proveedor: 'chatgpt', modelo: 'modelo-alterno' });

    expect(runtime.modeloVigente(true)).toBe('modelo-oficial');
  });

  it('rechaza un proveedor no integrado y un modelo no habilitado', () => {
    const runtime = new ConfiguracionModeloRuntime(configuracion());

    expect(() => runtime.seleccionar({ proveedor: 'gemini', modelo: '' })).toThrow(ErrorApi);
    expect(() => runtime.seleccionar({ proveedor: 'chatgpt', modelo: 'otro' })).toThrow(
      /no está habilitado/,
    );
    expect(runtime.modeloVigente(false)).toBe('modelo-oficial');
  });

  it('sin clave, OpenAI aparece como no disponible', () => {
    const estado = new ConfiguracionModeloRuntime(configuracion({ claveApi: null })).estado();

    expect(estado.claveConfigurada).toBe(false);
    expect(estado.proveedores[0]?.motivoNoDisponible).toMatch(/OPENAI_API_KEY/);
  });

  it('en reproduccion no se puede cambiar: los casetes fijan el modelo (HU-39)', () => {
    const runtime = new ConfiguracionModeloRuntime(
      configuracion({ modoLlm: 'replay', claveApi: null, directorioCasetes: 'casetes' }),
    );

    expect(runtime.estado().editable).toBe(false);
    expect(runtime.estado().claveConfigurada).toBe(true);
    expect(() => runtime.seleccionar({ proveedor: 'chatgpt', modelo: 'modelo-alterno' })).toThrow(
      ErrorApi,
    );
  });
});

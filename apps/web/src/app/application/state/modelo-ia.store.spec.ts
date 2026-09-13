import { TestBed } from '@angular/core/testing';
import {
  CONFIGURACION_MODELO_POR_DEFECTO,
  type ConfiguracionModeloIA,
} from '../../domain/models/proveedor-ia';
import type { ProveedorIARepository } from '../../domain/ports/proveedor-ia.repository';
import { PROVEEDOR_IA_REPOSITORY } from '../di/tokens';
import { ModeloIAStore } from './modelo-ia.store';

function configurar(guardada: ConfiguracionModeloIA = CONFIGURACION_MODELO_POR_DEFECTO) {
  const repositorio: jest.Mocked<ProveedorIARepository> = {
    cargar: jest.fn().mockResolvedValue(guardada),
    guardar: jest.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: PROVEEDOR_IA_REPOSITORY, useValue: repositorio }],
  });
  return { store: TestBed.inject(ModeloIAStore), repositorio };
}

describe('ModeloIAStore', () => {
  it('carga lo guardado al iniciar', async () => {
    const { store } = configurar({
      proveedor: 'gemini',
      modelo: 'gemini-1.5-pro',
      token: 'sk-123',
      urlAgenteLocal: '',
    });

    await store.iniciar();

    expect(store.configuracion().proveedor).toBe('gemini');
  });

  it('no guarda una configuracion invalida y expone los errores', async () => {
    const { store, repositorio } = configurar();

    const resultado = await store.guardar({
      proveedor: 'chatgpt',
      modelo: '',
      token: '',
      urlAgenteLocal: '',
    });

    expect(resultado.valido).toBe(false);
    expect(repositorio.guardar).not.toHaveBeenCalled();
    expect(store.configuracion()).toEqual(CONFIGURACION_MODELO_POR_DEFECTO);
  });

  it('guarda una configuracion valida y actualiza la signal', async () => {
    const { store, repositorio } = configurar();

    const resultado = await store.guardar({
      proveedor: 'local',
      modelo: '',
      token: 'tok-abc',
      urlAgenteLocal: 'http://localhost:9000',
    });

    expect(resultado.valido).toBe(true);
    expect(store.configuracion()).toEqual({
      proveedor: 'local',
      modelo: '',
      token: 'tok-abc',
      urlAgenteLocal: 'http://localhost:9000',
    });
    expect(repositorio.guardar).toHaveBeenCalledWith(store.configuracion());
  });
});

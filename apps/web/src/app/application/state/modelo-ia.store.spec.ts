import { TestBed } from '@angular/core/testing';
import { ErrorBackend } from '../../domain/errors/error-backend';
import type { CatalogoModeloIa } from '../../domain/models/modelo-ia';
import type { ModeloIaRepository } from '../../domain/ports/modelo-ia.repository';
import { MODELO_IA_REPOSITORY } from '../di/tokens';
import { ModeloIAStore } from './modelo-ia.store';

const CATALOGO: CatalogoModeloIa = {
  proveedores: [
    {
      id: 'chatgpt',
      nombre: 'ChatGPT',
      descripcion: 'Modelos GPT de OpenAI.',
      disponible: true,
      motivoNoDisponible: null,
      modelos: ['gpt-a', 'gpt-b'],
      modeloPorDefecto: 'gpt-a',
    },
    {
      id: 'claude',
      nombre: 'Claude',
      descripcion: 'Modelos Claude de Anthropic.',
      disponible: false,
      motivoNoDisponible: 'Todavía no está integrado.',
      modelos: [],
      modeloPorDefecto: null,
    },
  ],
  seleccion: { proveedor: 'chatgpt', modelo: 'gpt-a' },
  claveConfigurada: true,
  editable: true,
};

function configurar(catalogo: CatalogoModeloIa = CATALOGO) {
  const repositorio: jest.Mocked<ModeloIaRepository> = {
    obtener: jest.fn().mockResolvedValue(catalogo),
    seleccionar: jest.fn(async (seleccion) => ({ ...catalogo, seleccion })),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: MODELO_IA_REPOSITORY, useValue: repositorio }],
  });
  return { store: TestBed.inject(ModeloIAStore), repositorio };
}

describe('ModeloIAStore', () => {
  it('carga el catalogo del backend al iniciar', async () => {
    const { store } = configurar();
    await store.iniciar();
    expect(store.catalogo().proveedores).toHaveLength(2);
    expect(store.resumen()).toBe('ChatGPT · gpt-a');
  });

  it('guarda un modelo habilitado y actualiza la seleccion', async () => {
    const { store, repositorio } = configurar();
    await store.iniciar();

    const resultado = await store.seleccionar({ proveedor: 'chatgpt', modelo: 'gpt-b' });

    expect(resultado.ok).toBe(true);
    expect(repositorio.seleccionar).toHaveBeenCalledWith({ proveedor: 'chatgpt', modelo: 'gpt-b' });
    expect(store.catalogo().seleccion.modelo).toBe('gpt-b');
  });

  it('no llama al backend con un proveedor que no esta disponible', async () => {
    const { store, repositorio } = configurar();
    await store.iniciar();

    const resultado = await store.seleccionar({ proveedor: 'claude', modelo: '' });

    expect(resultado).toEqual({ ok: false, error: 'Todavía no está integrado.' });
    expect(repositorio.seleccionar).not.toHaveBeenCalled();
  });

  it('no llama al backend con un modelo que el servidor no habilita', async () => {
    const { store, repositorio } = configurar();
    await store.iniciar();

    const resultado = await store.seleccionar({ proveedor: 'chatgpt', modelo: 'gpt-inventado' });

    expect(resultado.ok).toBe(false);
    expect(repositorio.seleccionar).not.toHaveBeenCalled();
  });

  it('expone el mensaje del backend si guardar falla', async () => {
    const { store, repositorio } = configurar();
    await store.iniciar();
    repositorio.seleccionar.mockRejectedValue(new ErrorBackend('conflicto', 'No se puede ahora.'));

    const resultado = await store.seleccionar({ proveedor: 'chatgpt', modelo: 'gpt-b' });

    expect(resultado).toEqual({ ok: false, error: 'No se puede ahora.' });
    expect(store.error()).toBe('No se puede ahora.');
  });
});

import { TestBed } from '@angular/core/testing';
import { PREFERENCIAS_POR_DEFECTO, type Preferencias } from '../../domain/models/preferencias';
import type { PreferenciasRepository } from '../../domain/ports/preferencias.repository';
import { PREFERENCIAS_REPOSITORY } from '../di/tokens';
import { PreferenciasStore } from './preferencias.store';

function configurar(guardadas: Preferencias = PREFERENCIAS_POR_DEFECTO) {
  const repositorio: jest.Mocked<PreferenciasRepository> = {
    cargar: jest.fn().mockResolvedValue(guardadas),
    guardar: jest.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [{ provide: PREFERENCIAS_REPOSITORY, useValue: repositorio }],
  });
  return { store: TestBed.inject(PreferenciasStore), repositorio };
}

describe('PreferenciasStore', () => {
  it('carga lo guardado y aplica cambios de apariencia al instante', async () => {
    const { store, repositorio } = configurar({ ...PREFERENCIAS_POR_DEFECTO, tema: 'claro' });
    await store.iniciar();
    expect(store.preferencias().tema).toBe('claro');

    await store.cambiarTema('oscuro');
    await store.cambiarTamanoTexto('grande');

    expect(store.preferencias()).toEqual(
      expect.objectContaining({ tema: 'oscuro', tamanoTexto: 'grande' }),
    );
    expect(repositorio.guardar).toHaveBeenLastCalledWith(
      expect.objectContaining({ tema: 'oscuro', tamanoTexto: 'grande' }),
    );
  });

  it('solo guarda perfiles validos y actualiza las iniciales', async () => {
    const { store, repositorio } = configurar();

    const invalido = await store.guardarPerfil({ nombre: 'Ana', correo: 'ana', rol: 'docente' });
    expect(invalido.valido).toBe(false);
    expect(repositorio.guardar).not.toHaveBeenCalled();

    await store.guardarPerfil({ nombre: 'Ana Rojas', correo: 'ANA@uni.edu.co', rol: 'docente' });
    expect(store.preferencias().perfil).toEqual({
      nombre: 'Ana Rojas',
      correo: 'ana@uni.edu.co',
      rol: 'docente',
    });
    expect(store.iniciales()).toBe('AR');
  });
});

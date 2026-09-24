import type { ListarServiciosUseCase, Servicio } from '@unihelp/conocimiento';
import { ErrorApi } from '../http/error-api';
import { CatalogoSistemas, SISTEMAS_EMULADOS } from './sistemas-emulados';

function servicio(codigo: string): Servicio {
  return {
    codigo,
    nombre: codigo,
    descripcion: '',
    unidadResponsable: 'Oficina de Tecnologias',
    area: 'plataforma-virtual',
    nivelServicio: 'alto',
  };
}

function catalogoCon(codigos: readonly string[]): CatalogoSistemas {
  const listar = {
    ejecutar: () => Promise.resolve(codigos.map(servicio)),
  } as unknown as ListarServiciosUseCase;
  return new CatalogoSistemas(listar);
}

describe('CatalogoSistemas', () => {
  it('emula los cuatro sistemas que consultan las tareas de docs/tasks', async () => {
    const sistemas = await catalogoCon(SISTEMAS_EMULADOS).todos();

    expect(sistemas.map((s) => s.codigo)).toEqual([
      'aula_virtual',
      'autenticacion',
      'correo_institucional',
      'matricula',
    ]);
  });

  it('da a cada sistema su ruta propia, en kebab-case', async () => {
    const sistemas = await catalogoCon(SISTEMAS_EMULADOS).todos();

    expect(sistemas.find((s) => s.codigo === 'correo_institucional')?.ruta).toBe(
      '/simulacion/correo-institucional/salud',
    );
  });

  it('falla si la base no trae un sistema declarado: la ruta responderia 500', async () => {
    const catalogo = catalogoCon(SISTEMAS_EMULADOS.filter((c) => c !== 'matricula'));

    await expect(catalogo.todos()).rejects.toThrow(/matricula/);
  });

  it('falla si la semilla trae un servicio que el simulador no emula', async () => {
    const catalogo = catalogoCon([...SISTEMAS_EMULADOS, 'biblioteca']);

    await expect(catalogo.todos()).rejects.toThrow(/biblioteca/);
  });

  it('no cachea el fallo: la peticion siguiente reintenta si la base ya se sembro', async () => {
    let codigos: readonly string[] = [];
    const listar = {
      ejecutar: () => Promise.resolve(codigos.map(servicio)),
    } as unknown as ListarServiciosUseCase;
    const catalogo = new CatalogoSistemas(listar);

    await expect(catalogo.todos()).rejects.toBeInstanceOf(ErrorApi);
    codigos = SISTEMAS_EMULADOS;

    expect((await catalogo.todos()).length).toBe(4);
  });

  it('responde 404 por un sistema que no emula, no 500', async () => {
    const catalogo = catalogoCon(SISTEMAS_EMULADOS);

    await expect(catalogo.buscar('biblioteca')).rejects.toMatchObject({
      codigo: 'no-encontrado',
    });
  });
});

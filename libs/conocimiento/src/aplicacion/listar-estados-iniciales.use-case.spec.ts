import { cargarSemillaConocimiento } from '../infraestructura/cargar-semilla';
import { ListarEstadosInicialesUseCase } from './listar-estados-iniciales.use-case';

const semilla = cargarSemillaConocimiento();
const caso = new ListarEstadosInicialesUseCase(semilla);

describe('ListarEstadosInicialesUseCase', () => {
  it('lista los diez estados iniciales que usan las tareas de docs/tasks', () => {
    expect(caso.ejecutar().map((e) => e.codigo)).toEqual([
      'au_degradado_total',
      'au_degradado_total_envenenado',
      'au_fuera_total',
      'av_degradado_carga',
      'av_mantenimiento',
      'ci_degradado_filtros',
      'ci_fuera_parcial',
      'ma_fuera_parcial',
      'ma_mantenimiento',
      'todo_operativo',
    ]);
  });

  it('todo_operativo no deja ningun servicio afectado', () => {
    const base = caso.ejecutar().find((e) => e.codigo === 'todo_operativo');

    expect(base?.serviciosAfectados).toEqual([]);
  });

  it('declara que servicio afecta cada variante (T-DIA-001)', () => {
    const variante = caso.ejecutar().find((e) => e.codigo === 'av_degradado_carga');

    expect(variante?.serviciosAfectados).toEqual(['aula_virtual']);
  });
});

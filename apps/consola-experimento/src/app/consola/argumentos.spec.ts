import { ErrorApi } from '../http/error-api';
import { argumentosAnalisis, argumentosCorrida, comandoLegible } from './argumentos';

describe('argumentos del ejecutor', () => {
  it('arma exactamente las opciones de `ejecutor correr` y omite lo que no se anulo', () => {
    expect(
      argumentosCorrida({
        arquitecturas: ['B0'],
        tareas: ['T-COM-*', 'T-ADV-001'],
        repeticiones: null,
        modoLlm: 'replay',
        nombre: 'piloto-1',
      }),
    ).toEqual([
      'run',
      'python',
      '-u',
      '-m',
      'ejecutor',
      'correr',
      '--arquitecturas',
      'B0',
      '--tareas',
      'T-COM-*,T-ADV-001',
      '--modo-llm',
      'replay',
      '--nombre',
      'piloto-1',
    ]);
  });

  it('rechaza todo lo que no tenga la forma cerrada: nada del panel llega a un interprete', () => {
    const base = {
      arquitecturas: ['B0' as const],
      tareas: null,
      repeticiones: null,
      modoLlm: null,
      nombre: null,
    };
    expect(() => argumentosCorrida({ ...base, arquitecturas: [] })).toThrow(ErrorApi);
    expect(() => argumentosCorrida({ ...base, tareas: ['T-COM-001; rm -rf /'] })).toThrow(
      /forma invalida/,
    );
    expect(() => argumentosCorrida({ ...base, nombre: '../fuera' })).toThrow(
      /nombre de la corrida/,
    );
    expect(() => argumentosCorrida({ ...base, repeticiones: 0 })).toThrow(/repeticiones/);
    expect(() => argumentosCorrida({ ...base, modoLlm: 'otro' as never })).toThrow(/modo/);
  });

  it('el analisis apunta al directorio de la corrida dentro de experiment/', () => {
    expect(argumentosAnalisis({ corrida: 'b0-arreglada-v10' })).toEqual([
      'run',
      'papermill',
      'analisis.ipynb',
      'salidas/analisis.ejecutado.ipynb',
      '--cwd',
      '.',
      '-p',
      'directorio_corrida',
      'corridas/b0-arreglada-v10',
    ]);
    expect(() => argumentosAnalisis({ corrida: '../../etc' })).toThrow(ErrorApi);
  });

  it('muestra el comando tal como se ejecuto', () => {
    expect(comandoLegible('uv', ['run', 'python', '-m', 'ejecutor', 'correr'])).toBe(
      'uv run python -m ejecutor correr',
    );
  });
});

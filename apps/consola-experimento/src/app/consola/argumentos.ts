import type { LanzarAnalisisDto, LanzarCorridaDto } from '@unihelp/contratos';
import { MODOS_LLM_CONSOLA } from '@unihelp/contratos';
import { esIdentificadorArquitectura } from '@unihelp/dominio';
import { ErrorApi } from '../http/error-api';

/**
 * Traduce lo que pide el panel a la lista de argumentos del proceso. Cada valor
 * se valida contra una forma cerrada y el proceso se lanza SIN interprete de
 * comandos (`shell: false`), asi que ningun texto del panel puede convertirse
 * en un comando distinto del ejecutor o del cuaderno.
 */

const PATRON_TAREA = /^T-(INF|DIA|COM|ADV)-(\d{3}|\*)$/;
/** Mismo criterio que `corrida.py` y que el panel: un directorio sin barras ni espacios. */
const PATRON_NOMBRE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const MAXIMO_REPETICIONES = 50;

/** `uv run python -u -m ejecutor correr ...`, como lo describe `experiment/README.md`. */
export function argumentosCorrida(dto: LanzarCorridaDto): string[] {
  if (!Array.isArray(dto.arquitecturas) || dto.arquitecturas.length === 0) {
    throw new ErrorApi('validacion', 'Elige al menos una arquitectura.');
  }
  const desconocidas = dto.arquitecturas.filter((a) => !esIdentificadorArquitectura(a));
  if (desconocidas.length) {
    throw new ErrorApi('validacion', `Arquitecturas desconocidas: ${desconocidas.join(', ')}.`);
  }
  const argumentos = [
    'run',
    'python',
    '-u',
    '-m',
    'ejecutor',
    'correr',
    '--arquitecturas',
    [...new Set(dto.arquitecturas)].join(','),
  ];
  if (dto.tareas !== null && dto.tareas !== undefined) {
    if (!Array.isArray(dto.tareas) || dto.tareas.length === 0) {
      throw new ErrorApi('validacion', 'Elige al menos una tarea o deja la lista en null.');
    }
    const invalidas = dto.tareas.filter((t) => typeof t !== 'string' || !PATRON_TAREA.test(t));
    if (invalidas.length) {
      throw new ErrorApi('validacion', `Tareas con forma invalida: ${invalidas.join(', ')}.`);
    }
    argumentos.push('--tareas', dto.tareas.join(','));
  }
  if (dto.repeticiones !== null && dto.repeticiones !== undefined) {
    if (
      !Number.isInteger(dto.repeticiones) ||
      dto.repeticiones < 1 ||
      dto.repeticiones > MAXIMO_REPETICIONES
    ) {
      throw new ErrorApi(
        'validacion',
        `Las repeticiones deben ser un entero entre 1 y ${MAXIMO_REPETICIONES}.`,
      );
    }
    argumentos.push('--repeticiones', String(dto.repeticiones));
  }
  if (dto.modoLlm !== null && dto.modoLlm !== undefined) {
    if (!(MODOS_LLM_CONSOLA as readonly string[]).includes(dto.modoLlm)) {
      throw new ErrorApi('validacion', 'El modo del modelo debe ser live, record o replay.');
    }
    argumentos.push('--modo-llm', dto.modoLlm);
  }
  if (dto.nombre !== null && dto.nombre !== undefined) {
    argumentos.push('--nombre', validarNombreCorrida(dto.nombre));
  }
  return argumentos;
}

/** `uv run papermill ... -p directorio_corrida corridas/<nombre>`, como en `experiment/README.md`. */
export function argumentosAnalisis(dto: LanzarAnalisisDto): string[] {
  const nombre = validarNombreCorrida(dto.corrida);
  return [
    'run',
    'papermill',
    'analisis.ipynb',
    'salidas/analisis.ejecutado.ipynb',
    '--cwd',
    '.',
    '-p',
    'directorio_corrida',
    `corridas/${nombre}`,
  ];
}

/** `uv run python -u -m ejecutor indice`: reescribe el catalogo tras cualquier corrida. */
export function argumentosIndice(): string[] {
  return ['run', 'python', '-u', '-m', 'ejecutor', 'indice'];
}

export function validarNombreCorrida(nombre: unknown): string {
  if (typeof nombre !== 'string' || !PATRON_NOMBRE.test(nombre)) {
    throw new ErrorApi(
      'validacion',
      'El nombre de la corrida solo admite letras, numeros, punto, guion y guion bajo.',
    );
  }
  return nombre;
}

/** Linea legible del comando, para mostrarla y poder repetirla en una terminal. */
export function comandoLegible(ejecutable: string, argumentos: readonly string[]): string {
  return [ejecutable, ...argumentos]
    .map((parte) => (/\s/.test(parte) ? `"${parte}"` : parte))
    .join(' ');
}

import type { IdentidadServicio } from '@unihelp/contratos';

/**
 * Identidad de este servicio. Es la unica pieza que cambia entre las apps de
 * backend: el resto del modulo de salud es identico en todas.
 *
 * La consola no pertenece a ninguna arquitectura ni integra agentes: es la
 * herramienta local que lanza el ejecutor y el cuaderno desde el panel web
 * (decision 39). No aporta ningun salto a la medicion: el ejecutor mide igual
 * lo lance la consola o una terminal.
 */
export const IDENTIDAD: IdentidadServicio = {
  arquitectura: 'COMPARTIDO',
  servicio: 'consola-experimento',
  rol: 'sistema-emulado',
  protocolo: 'ninguno',
  descripcion:
    'Consola del experimento: lanza el ejecutor de las 40 tareas y el cuaderno de analisis desde el panel web, uno a la vez, y transmite su progreso.',
  consumidoPor: ['B0', 'B1', 'B2', 'B3'],
  dependencias: ['uv'],
};

/** Puerto por defecto en ejecucion local (`nx serve consola-experimento`). */
export const PUERTO_POR_DEFECTO = 3030;

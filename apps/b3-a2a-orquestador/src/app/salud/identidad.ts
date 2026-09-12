import type { IdentidadServicio } from '@unihelp/contratos';

/**
 * Identidad de este servicio. Es la unica pieza que cambia entre las apps de
 * backend: el resto del modulo de salud es identico en todas, de modo que las
 * cuatro arquitecturas se comparan con el mismo contrato.
 */
export const IDENTIDAD: IdentidadServicio = {
  arquitectura: 'B3',
  servicio: 'b3-a2a-orquestador',
  rol: 'orquestador',
  protocolo: 'a2a',
  descripcion:
    'Orquestador que delega en agentes especialistas remotos mediante el protocolo Agent2Agent.',
  consumidoPor: ['B3'],
  dependencias: ['b3-a2a-conocimiento', 'b3-a2a-diagnostico', 'mcp-server'],
};

/** Puerto por defecto en ejecucion local (`nx serve b3-a2a-orquestador`). */
export const PUERTO_POR_DEFECTO = 3003;

import type { IdentidadServicio } from '@unihelp/contratos';

/**
 * Identidad de este servicio. Es la unica pieza que cambia entre las apps de
 * backend: el resto del modulo de salud es identico en todas, de modo que las
 * cuatro arquitecturas se comparan con el mismo contrato.
 */
export const IDENTIDAD: IdentidadServicio = {
  arquitectura: 'B3',
  servicio: 'b3-a2a-diagnostico',
  rol: 'especialista',
  protocolo: 'a2a',
  descripcion:
    'Agente especialista en diagnostico de incidentes, expuesto como servicio A2A independiente.',
  consumidoPor: ['B3'],
  dependencias: ['mcp-server'],
};

/** Puerto por defecto en ejecucion local (`nx serve b3-a2a-diagnostico`). */
export const PUERTO_POR_DEFECTO = 3005;

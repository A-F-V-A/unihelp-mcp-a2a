import type { IdentidadServicio } from '@unihelp/contratos';

/**
 * Identidad de este servicio. Es la unica pieza que cambia entre las apps de
 * backend: el resto del modulo de salud es identico en todas, de modo que las
 * cuatro arquitecturas se comparan con el mismo contrato.
 */
export const IDENTIDAD: IdentidadServicio = {
  arquitectura: 'B0',
  servicio: 'b0-directo',
  rol: 'agente-unico',
  protocolo: 'directo',
  descripcion:
    'Agente unico que invoca la API del dominio directamente, sin protocolo de integracion intermedio.',
  consumidoPor: ['B0'],
  dependencias: [],
};

/** Puerto por defecto en ejecucion local (`nx serve b0-directo`). */
export const PUERTO_POR_DEFECTO = 3000;

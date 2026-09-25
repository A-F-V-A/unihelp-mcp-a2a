import type { IdentidadServicio } from '@unihelp/contratos';

/**
 * Identidad de este servicio. Es la unica pieza que cambia entre las apps de
 * backend: el resto del modulo de salud es identico en todas, de modo que las
 * cuatro arquitecturas se comparan con el mismo contrato.
 */
export const IDENTIDAD: IdentidadServicio = {
  arquitectura: 'B2',
  servicio: 'b2-multiagente-local',
  rol: 'orquestador',
  protocolo: 'en-proceso',
  descripcion:
    'Orquestador y dos agentes especializados coordinados en memoria dentro del mismo proceso, sin protocolo de red entre ellos; las herramientas se alcanzan por MCP.',
  consumidoPor: ['B2'],
  dependencias: ['mcp-server'],
};

/** Puerto por defecto en ejecucion local (`nx serve b2-multiagente-local`). */
export const PUERTO_POR_DEFECTO = 3002;

import type { IdentidadServicio } from '@unihelp/contratos';

/**
 * Identidad de este servicio. Es la unica pieza que cambia entre las apps de
 * backend: el resto del modulo de salud es identico en todas, de modo que las
 * cuatro arquitecturas se comparan con el mismo contrato.
 */
export const IDENTIDAD: IdentidadServicio = {
  arquitectura: 'B1',
  servicio: 'b1-mcp-agente',
  rol: 'agente-unico',
  protocolo: 'mcp',
  descripcion:
    'Agente unico que consume las capacidades del dominio como herramientas de un servidor MCP.',
  consumidoPor: ['B1'],
  dependencias: ['mcp-server'],
};

/** Puerto por defecto en ejecucion local (`nx serve b1-mcp-agente`). */
export const PUERTO_POR_DEFECTO = 3001;

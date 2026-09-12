import type { IdentidadServicio } from '@unihelp/contratos';

/**
 * Identidad de este servicio. Es la unica pieza que cambia entre las apps de
 * backend: el resto del modulo de salud es identico en todas, de modo que las
 * cuatro arquitecturas se comparan con el mismo contrato.
 */
export const IDENTIDAD: IdentidadServicio = {
  arquitectura: 'COMPARTIDO',
  servicio: 'mcp-server',
  rol: 'servidor-herramientas',
  protocolo: 'mcp',
  descripcion:
    'Servidor de herramientas MCP compartido: expone las capacidades del dominio a los agentes que hablan MCP.',
  consumidoPor: ['B1', 'B3'],
  dependencias: [],
};

/** Puerto por defecto en ejecucion local (`nx serve mcp-server`). */
export const PUERTO_POR_DEFECTO = 3010;

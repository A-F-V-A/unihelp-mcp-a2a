import type { ContextoInvocacion, NombreHerramienta, SalidaCapacidad } from '@unihelp/herramientas';

/**
 * Implementacion de UNA capacidad: traduce los argumentos ya validados a un
 * caso de uso compartido y el resultado al esquema de salida de la herramienta.
 * No sabe nada de MCP ni de function calling: B0 la invoca en proceso y
 * `mcp-server` la publica como herramienta, con el MISMO codigo (RNF-01).
 */
export interface Capacidad {
  readonly nombre: NombreHerramienta | string;
  ejecutar(
    argumentos: Record<string, unknown>,
    contexto: ContextoInvocacion,
  ): Promise<SalidaCapacidad>;
}

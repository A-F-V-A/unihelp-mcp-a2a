import type { ContextoInvocacion, NombreHerramienta, SalidaCapacidad } from '@unihelp/herramientas';

/**
 * Adaptador local de UNA herramienta: traduce sus argumentos a un caso de uso
 * compartido y el resultado al esquema de salida. Hace el mismo trabajo que el
 * manejador de esa herramienta en `mcp-server` (B1).
 */
export interface AdaptadorHerramienta {
  readonly nombre: NombreHerramienta;
  ejecutar(
    argumentos: Record<string, unknown>,
    contexto: ContextoInvocacion,
  ): Promise<SalidaCapacidad>;
}

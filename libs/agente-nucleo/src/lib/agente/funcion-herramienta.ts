import type { DescripcionCapacidad } from '@unihelp/herramientas';
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';

/**
 * Traduce las capacidades del puerto al formato de function calling del
 * proveedor. Es el UNICO lugar donde se hace: B0 y B1 pasan por aqui, asi que
 * la unica diferencia posible en lo que recibe el modelo es lo que cada puerto
 * lista, nunca como se traduce (RNF-01).
 */
export function aFunctionCalling(
  capacidades: readonly DescripcionCapacidad[],
): ChatCompletionFunctionTool[] {
  return capacidades.map((c) => ({
    type: 'function',
    function: {
      name: c.nombre,
      description: c.descripcion,
      parameters: c.esquemaEntrada as Record<string, unknown>,
    },
  }));
}

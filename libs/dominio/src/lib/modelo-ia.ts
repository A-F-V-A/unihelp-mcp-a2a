/**
 * Proveedores de modelo de lenguaje que la interfaz puede ofrecer. Solo
 * vocabulario: que proveedor esta realmente disponible, con que modelos y con
 * que clave lo decide cada backend, nunca el navegador.
 *
 * Los identificadores son los que ya usaba la interfaz: `chatgpt` es la familia
 * GPT de OpenAI y `claude` la de Anthropic.
 */
export const PROVEEDORES_MODELO = ['chatgpt', 'gemini', 'claude', 'local'] as const;

export type ProveedorModelo = (typeof PROVEEDORES_MODELO)[number];

/** Type guard para un identificador recibido por red o desde almacenamiento. */
export function esProveedorModelo(valor: unknown): valor is ProveedorModelo {
  return typeof valor === 'string' && (PROVEEDORES_MODELO as readonly string[]).includes(valor);
}

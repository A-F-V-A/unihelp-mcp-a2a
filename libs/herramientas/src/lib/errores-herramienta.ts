/**
 * Errores tipados de herramienta (docs/02, seccion 5). Un error viaja al modelo
 * con `isError: true` y queda en `tool_calls[].resultado_status` (M2.6).
 */

export const CODIGOS_ERROR_HERRAMIENTA = [
  'VALIDACION_ENTRADA',
  'RECURSO_NO_ENCONTRADO',
  'CONFIRMACION_REQUERIDA',
  'PROPUESTA_EXPIRADA',
  'PROPUESTA_INCOMPLETA',
  'PROPUESTA_RESUELTA',
  'SERVICIO_NO_DISPONIBLE',
  'LIMITE_EXCEDIDO',
] as const;

export type CodigoErrorHerramienta = (typeof CODIGOS_ERROR_HERRAMIENTA)[number];

/** Error de una herramienta. El mensaje es para el modelo y la persona: en español (RM-11). */
export class ErrorHerramienta extends Error {
  constructor(
    readonly codigo: CodigoErrorHerramienta,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export function esCodigoErrorHerramienta(valor: unknown): valor is CodigoErrorHerramienta {
  return (
    typeof valor === 'string' && (CODIGOS_ERROR_HERRAMIENTA as readonly string[]).includes(valor)
  );
}

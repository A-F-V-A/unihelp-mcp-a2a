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

/**
 * Fallo que NO es de la arquitectura evaluada: el proveedor del modelo no
 * respondio, la base no responde, el servidor MCP no contesta o falta la
 * grabacion de un casete. La ejecucion termina como `error_infraestructura`, se
 * reejecuta y se excluye; nunca cuenta como fallo del agente (RM-15; DP-17
 * provisional). La subclase de cada componente solo aporta el nombre.
 */
export class ErrorInfraestructura extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

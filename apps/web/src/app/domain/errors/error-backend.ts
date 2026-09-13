import type { CodigoErrorApi } from '@unihelp/contratos';

/**
 * Codigos que puede ver la aplicacion: los que devuelve la API mas los que
 * solo existen del lado del cliente (el backend nunca responde un timeout).
 */
export type CodigoErrorBackend = CodigoErrorApi | 'timeout' | 'sin-conexion';

const REINTENTABLES: ReadonlySet<CodigoErrorBackend> = new Set<CodigoErrorBackend>([
  'timeout',
  'sin-conexion',
  'servicio-no-disponible',
  'interno',
]);

/**
 * Unico tipo de error que cruza la frontera de los repositorios. Tanto la
 * implementacion HTTP como la simulada traducen sus fallos a este tipo, de modo
 * que casos de uso, store y componentes no distinguen de donde vino.
 */
export class ErrorBackend extends Error {
  override readonly name = 'ErrorBackend';

  constructor(
    readonly codigo: CodigoErrorBackend,
    mensaje: string,
    readonly detalles: Readonly<Record<string, string | number>> = {},
  ) {
    super(mensaje);
  }

  get reintentable(): boolean {
    return REINTENTABLES.has(this.codigo);
  }
}

export function esErrorBackend(valor: unknown): valor is ErrorBackend {
  return valor instanceof ErrorBackend;
}

/** Garantiza un {@link ErrorBackend} aun ante fallos inesperados (bugs, excepciones de terceros). */
export function normalizarError(valor: unknown): ErrorBackend {
  if (esErrorBackend(valor)) {
    return valor;
  }
  return new ErrorBackend(
    'interno',
    'Ocurrió un error inesperado. Intenta de nuevo en unos segundos.',
  );
}

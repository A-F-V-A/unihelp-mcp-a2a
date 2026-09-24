import type { CodigoErrorApi } from '@unihelp/contratos';

/** Status HTTP de cada codigo de error del contrato (`api.contrato.ts`). */
export const STATUS_POR_CODIGO: Readonly<Record<CodigoErrorApi, number>> = {
  validacion: 400,
  'no-encontrado': 404,
  conflicto: 409,
  'limite-turnos': 429,
  interno: 500,
  'servicio-no-disponible': 503,
};

/** Error que se responde tal cual como `ErrorApiDto`. El mensaje va en español (RM-11). */
export class ErrorApi extends Error {
  constructor(
    readonly codigo: CodigoErrorApi,
    mensaje: string,
    readonly detalles?: Readonly<Record<string, string | number>>,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

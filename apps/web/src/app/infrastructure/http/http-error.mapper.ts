import { HttpErrorResponse } from '@angular/common/http';
import type { CodigoErrorApi } from '@unihelp/contratos';
import { TimeoutError } from 'rxjs';
import { ErrorBackend, esErrorBackend } from '../../domain/errors/error-backend';
import { esErrorApiDto, mapearErrorApi } from '../mappers/error.mapper';

const CODIGO_POR_STATUS: Readonly<Record<number, CodigoErrorApi>> = {
  400: 'validacion',
  404: 'no-encontrado',
  409: 'conflicto',
  422: 'validacion',
  429: 'limite-turnos',
  503: 'servicio-no-disponible',
};

/** Traduce cualquier fallo de HttpClient al error de dominio. */
export function mapearFalloHttp(fallo: unknown): ErrorBackend {
  if (esErrorBackend(fallo)) {
    return fallo;
  }

  if (fallo instanceof TimeoutError) {
    return new ErrorBackend('timeout', 'El servidor tardó demasiado en responder.');
  }

  if (fallo instanceof HttpErrorResponse) {
    if (fallo.status === 0) {
      return new ErrorBackend(
        'sin-conexion',
        'No fue posible comunicarse con el servidor. Revisa tu conexión.',
      );
    }

    if (esErrorApiDto(fallo.error)) {
      return mapearErrorApi(fallo.error);
    }

    return new ErrorBackend(
      CODIGO_POR_STATUS[fallo.status] ?? 'interno',
      `El servidor respondió ${fallo.status} ${fallo.statusText}.`.trim(),
      { status: fallo.status },
    );
  }

  return new ErrorBackend('interno', 'Ocurrió un error inesperado al contactar el servidor.');
}

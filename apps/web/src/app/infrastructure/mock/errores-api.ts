import type { CodigoErrorApi, ErrorApiDto } from '@unihelp/contratos';
import type { ErrorBackend } from '../../domain/errors/error-backend';
import { mapearErrorApi } from '../mappers/error.mapper';

/**
 * Los repositorios simulados fallan construyendo el MISMO cuerpo de error que
 * enviaria la API y pasandolo por el mismo mapper que usa la version HTTP.
 */
export function falloApi(
  codigo: CodigoErrorApi,
  mensaje: string,
  detalles?: ErrorApiDto['detalles'],
): ErrorBackend {
  return mapearErrorApi({ codigo, mensaje, detalles });
}

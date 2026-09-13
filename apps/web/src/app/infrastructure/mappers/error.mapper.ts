import { CODIGOS_ERROR_API, type ErrorApiDto } from '@unihelp/contratos';
import { ErrorBackend } from '../../domain/errors/error-backend';

export function esErrorApiDto(valor: unknown): valor is ErrorApiDto {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const candidato = valor as Partial<ErrorApiDto>;
  return (
    typeof candidato.mensaje === 'string' &&
    (CODIGOS_ERROR_API as readonly string[]).includes(candidato.codigo ?? '')
  );
}

export function mapearErrorApi(dto: ErrorApiDto): ErrorBackend {
  return new ErrorBackend(dto.codigo, dto.mensaje, dto.detalles ?? {});
}

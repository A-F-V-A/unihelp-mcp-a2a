import { ErrorConocimiento } from '@unihelp/conocimiento';
import { ErrorHerramienta } from '@unihelp/herramientas';
import { ErrorTickets } from '@unihelp/tickets';

/**
 * Traduce un fallo de un caso de uso compartido al error tipado de la
 * herramienta (docs/02, 5). Lo que no es de negocio (la base no responde) queda
 * como `SERVICIO_NO_DISPONIBLE`.
 */
export function traducirFalloCapacidad(fallo: unknown): ErrorHerramienta {
  if (fallo instanceof ErrorHerramienta) {
    return fallo;
  }
  if (fallo instanceof ErrorTickets) {
    return new ErrorHerramienta(fallo.codigo, fallo.message);
  }
  if (fallo instanceof ErrorConocimiento) {
    return new ErrorHerramienta(
      fallo.codigo === 'consulta-invalida' ? 'VALIDACION_ENTRADA' : 'RECURSO_NO_ENCONTRADO',
      fallo.message,
    );
  }
  return new ErrorHerramienta(
    'SERVICIO_NO_DISPONIBLE',
    'El servicio de datos no respondió; no se obtuvo resultado.',
  );
}

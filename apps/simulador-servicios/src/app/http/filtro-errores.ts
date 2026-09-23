import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { CodigoErrorApi, ErrorApiDto } from '@unihelp/contratos';
import { ErrorConocimiento } from '@unihelp/conocimiento';
import { ErrorApi, STATUS_POR_CODIGO } from './error-api';

/** Lo unico que el filtro usa de la respuesta de Express. */
interface RespuestaHttp {
  status(codigo: number): { json(cuerpo: unknown): void };
}

/**
 * Convierte cualquier fallo en el `ErrorApiDto` del contrato (`CODIGOS_ERROR_API`).
 * El simulador solo puede fallar por tres motivos, asi que la traduccion es mas
 * corta que la de B0: un error de la base de conocimiento, un `ErrorApi` propio
 * o una ruta inexistente. Nunca devuelve una traza de pila.
 */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly logger = new Logger('FiltroErrores');

  catch(fallo: unknown, host: ArgumentsHost): void {
    const cuerpo = this.traducir(fallo);
    host
      .switchToHttp()
      .getResponse<RespuestaHttp>()
      .status(STATUS_POR_CODIGO[cuerpo.codigo])
      .json(cuerpo);
  }

  private traducir(fallo: unknown): ErrorApiDto {
    if (fallo instanceof ErrorApi) {
      return { codigo: fallo.codigo, mensaje: fallo.message, detalles: fallo.detalles };
    }
    if (fallo instanceof ErrorConocimiento) {
      return { codigo: codigoDeConocimiento(fallo.codigo), mensaje: fallo.message };
    }
    if (fallo instanceof HttpException) {
      const status = fallo.getStatus();
      return {
        codigo: status === 404 ? 'no-encontrado' : status < 500 ? 'validacion' : 'interno',
        mensaje: status === 404 ? 'La ruta solicitada no existe.' : 'La petición no es válida.',
      };
    }
    this.logger.error(fallo instanceof Error ? (fallo.stack ?? fallo.message) : String(fallo));
    return { codigo: 'interno', mensaje: 'Ocurrió un error interno al atender la solicitud.' };
  }
}

/**
 * `restablecimiento-no-permitido` es 409 y no 404: la ruta existe y el estado
 * pedido tambien; lo que no se puede es conmutar fuera del perfil de
 * experimento, y quien llama necesita distinguir los dos casos (HU-36).
 */
function codigoDeConocimiento(codigo: ErrorConocimiento['codigo']): CodigoErrorApi {
  if (codigo.endsWith('no-encontrada') || codigo.endsWith('no-encontrado')) {
    return 'no-encontrado';
  }
  if (codigo === 'restablecimiento-no-permitido') {
    return 'conflicto';
  }
  if (codigo === 'seleccion-estado-invalida' || codigo === 'consulta-invalida') {
    return 'validacion';
  }
  return 'interno';
}

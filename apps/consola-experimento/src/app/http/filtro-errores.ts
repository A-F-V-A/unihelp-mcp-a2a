import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ErrorApiDto } from '@unihelp/contratos';
import { ErrorApi, STATUS_POR_CODIGO } from './error-api';

/** Lo unico que el filtro usa de la respuesta de Express. */
interface RespuestaHttp {
  status(codigo: number): { json(cuerpo: unknown): void };
}

/**
 * Convierte cualquier fallo en el `ErrorApiDto` del contrato (`CODIGOS_ERROR_API`).
 * La consola solo falla por un `ErrorApi` propio (argumentos invalidos, trabajo
 * en marcha, corrida inexistente) o por una ruta que no existe. Nunca devuelve
 * una traza de pila.
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

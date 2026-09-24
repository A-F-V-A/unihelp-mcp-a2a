import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { CodigoErrorApi, ErrorApiDto } from '@unihelp/contratos';
import { ErrorConocimiento } from '@unihelp/conocimiento';
import { ErrorInfraestructura } from '@unihelp/herramientas';
import { ErrorTickets } from '@unihelp/tickets';
import { ErrorApi, STATUS_POR_CODIGO } from './error-api';

const CODIGO_TICKETS: Readonly<Record<ErrorTickets['codigo'], CodigoErrorApi>> = {
  VALIDACION_ENTRADA: 'validacion',
  RECURSO_NO_ENCONTRADO: 'no-encontrado',
  CONFIRMACION_REQUERIDA: 'conflicto',
  PROPUESTA_EXPIRADA: 'conflicto',
  PROPUESTA_INCOMPLETA: 'conflicto',
  PROPUESTA_RESUELTA: 'conflicto',
};

/** Lo unico que el filtro usa de la respuesta de Express. */
interface RespuestaHttp {
  status(codigo: number): { json(cuerpo: unknown): void };
}

/**
 * Convierte cualquier fallo en el `ErrorApiDto` del contrato, con su status
 * (`CODIGOS_ERROR_API`). Nunca devuelve una traza de pila a la persona.
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
    if (fallo instanceof ErrorTickets) {
      return {
        codigo: CODIGO_TICKETS[fallo.codigo],
        mensaje: fallo.message,
        detalles: fallo.detalles,
      };
    }
    if (fallo instanceof ErrorConocimiento) {
      const codigo: CodigoErrorApi =
        fallo.codigo.endsWith('no-encontrada') || fallo.codigo.endsWith('no-encontrado')
          ? 'no-encontrado'
          : fallo.codigo === 'consulta-invalida'
            ? 'validacion'
            : 'interno';
      return { codigo, mensaje: fallo.message };
    }
    // Modelo, servidor de herramientas o base: la ejecucion termina como
    // `error_infraestructura` para el ejecutor, que lee el 503 (RM-15).
    if (fallo instanceof ErrorInfraestructura) {
      this.logger.warn(fallo.message);
      return {
        codigo: 'servicio-no-disponible',
        mensaje:
          'Un componente del que depende el asistente no respondió. Intenta de nuevo en unos segundos.',
      };
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

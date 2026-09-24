import type { IncomingMessage, ServerResponse } from 'node:http';
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { SesionesMcp } from './sesiones-mcp';

/**
 * Punto de entrada HTTP del protocolo: `POST`, `GET` (flujo SSE de
 * notificaciones) y `DELETE` (cierre de sesion) sobre `/mcp`, fuera de `/api`
 * (docs/02). Solo entrega la peticion cruda al transporte del SDK: Nest ya
 * interpreto el cuerpo JSON y el SDK escribe la respuesta por su cuenta.
 */
@Controller('mcp')
export class McpController {
  constructor(@Inject(SesionesMcp) private readonly sesiones: SesionesMcp) {}

  @All()
  atender(
    @Req() peticion: IncomingMessage & { body?: unknown },
    @Res() respuesta: ServerResponse,
  ): Promise<void> {
    return this.sesiones.atender(
      peticion,
      respuesta,
      peticion.method === 'POST' ? peticion.body : undefined,
    );
  }
}

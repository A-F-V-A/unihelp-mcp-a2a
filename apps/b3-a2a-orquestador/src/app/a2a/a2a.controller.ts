import { Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import type { A2aMessageDto, A2aTaskDto } from '@unihelp/contratos';
import { CABECERA_TRACE_ID, RUTA_A2A } from '@unihelp/contratos';
import { TriajeService } from '../triaje/triaje.service';

interface JsonRpcPeticion<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params?: T;
}

interface MessageSendParams {
  readonly message?: A2aMessageDto;
  readonly taskId?: string;
  readonly conversacionId?: string;
}

interface JsonRpcRespuesta<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly result?: T;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

/**
 * Controlador A2A v1.0 para el orquestador B3 (HU-29, HU-30, HU-31).
 *
 * Atiende mensajes JSON-RPC 2.0 en `POST /a2a`, delega al TriajeService y
 * retorna el artefacto A2A estandarizado `resultado_triaje` para el runner y evaluador.
 */
@Controller()
export class A2aOrquestadorController {
  private readonly logger = new Logger(A2aOrquestadorController.name);

  constructor(private readonly triajeService: TriajeService) {}

  @Post(RUTA_A2A.slice(1))
  @HttpCode(HttpStatus.OK)
  async atenderMensaje(
    @Body() peticion: JsonRpcPeticion<MessageSendParams>,
    @Headers(CABECERA_TRACE_ID) trazaCabecera?: string,
  ): Promise<JsonRpcRespuesta<A2aTaskDto>> {
    const reqId = peticion?.id ?? 'req-orquestador';

    if (peticion?.jsonrpc !== '2.0' || peticion?.method !== 'message/send') {
      return {
        jsonrpc: '2.0',
        id: reqId,
        error: {
          code: -32601,
          message: 'Método no soportado. Se espera JSON-RPC 2.0 con método «message/send».',
        },
      };
    }

    const mensaje = peticion.params?.message;
    const conversacionId = peticion.params?.conversacionId ?? peticion.params?.taskId ?? null;
    const traceId = trazaCabecera ?? mensaje?.metadata?.traceId ?? `trace-a2a-${Date.now()}`;

    const parteTexto = mensaje?.parts?.find((p) => p.kind === 'text');
    const texto = parteTexto && 'text' in parteTexto ? parteTexto.text : '';

    if (!texto.trim()) {
      return {
        jsonrpc: '2.0',
        id: reqId,
        result: {
          id: peticion.params?.taskId ?? 'task-vacia',
          status: 'failed',
          messages: [],
          artifacts: [],
        },
      };
    }

    try {
      const res = await this.triajeService.procesarTurno(conversacionId, texto, traceId);
      return {
        jsonrpc: '2.0',
        id: reqId,
        result: res.tareaA2a,
      };
    } catch (fallo) {
      this.logger.error(`Fallo en orquestación A2A: ${(fallo as Error).message}`);
      return {
        jsonrpc: '2.0',
        id: reqId,
        result: {
          id: peticion.params?.taskId ?? 'task-fallida',
          status: 'failed',
          messages: [
            {
              role: 'agent',
              parts: [
                {
                  kind: 'text',
                  text: `Fallo interno en orquestador B3: ${(fallo as Error).message}`,
                },
              ],
            },
          ],
          artifacts: [],
        },
      };
    }
  }
}

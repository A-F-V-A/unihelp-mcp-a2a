import { Injectable, Logger } from '@nestjs/common';
import type {
  A2aTaskDto,
  AgentCardDto,
} from '@unihelp/contratos';
import { CABECERA_TRACE_ID } from '@unihelp/contratos';
import { ahoraMonotonoMs } from '@unihelp/herramientas';

interface JsonRpcPeticion<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params: T;
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
 * Cliente A2A para delegar solicitudes a especialistas remotos sobre HTTP y JSON-RPC 2.0 (HU-29, HU-30, HU-33).
 */
@Injectable()
export class ClienteA2aService {
  private readonly logger = new Logger(ClienteA2aService.name);

  /**
   * Envia un mensaje A2A a un especialista y espera la tarea con su artefacto de resultado.
   */
  async enviarMensaje(
    card: AgentCardDto,
    mensajeTexto: string,
    traceId = 'trace-orquestador-a2a',
    hop = 1,
  ): Promise<{ task: A2aTaskDto; rttMs: number } | null> {
    const inicio = ahoraMonotonoMs();
    const reqId = `req-a2a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const cuerpo: JsonRpcPeticion = {
      jsonrpc: '2.0',
      id: reqId,
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ kind: 'text', text: mensajeTexto }],
          metadata: {
            traceId,
            hop,
            emisor: 'b3-a2a-orquestador',
            receptor: card.name,
            t_emision: new Date().toISOString(),
          },
        },
      },
    };

    this.logger.log(`Enviando A2A message/send hacia «${card.name}» en ${card.url}`);

    try {
      const respuesta = await fetch(card.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          [CABECERA_TRACE_ID]: traceId,
        },
        body: JSON.stringify(cuerpo),
      });

      const rttMs = ahoraMonotonoMs() - inicio;

      if (!respuesta.ok) {
        this.logger.warn(
          `Especialista «${card.name}» respondió HTTP ${respuesta.status} en ${card.url}`,
        );
        return null;
      }

      const json = (await respuesta.json()) as JsonRpcRespuesta<A2aTaskDto>;
      if (json.error || !json.result) {
        this.logger.warn(
          `Especialista «${card.name}» devolvió error JSON-RPC: ${json.error?.message ?? 'Sin result'}`,
        );
        return null;
      }

      return {
        task: json.result,
        rttMs,
      };
    } catch (fallo) {
      const durMs = ahoraMonotonoMs() - inicio;
      this.logger.error(
        `Error de red al conectar con especialista «${card.name}» (${card.url}) tras ${durMs}ms: ${(fallo as Error).message}`,
      );
      return null;
    }
  }
}

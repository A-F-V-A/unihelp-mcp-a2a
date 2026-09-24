import { Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import type {
  A2aArtifactDto,
  A2aMessageDto,
  A2aTaskDto,
  MetadataMensajeA2aDto,
} from '@unihelp/contratos';
import { CABECERA_TRACE_ID, RUTA_A2A } from '@unihelp/contratos';
import { ahoraMonotonoMs } from '@unihelp/herramientas';
import { KnowledgeLookupService } from './knowledge-lookup.service';

interface JsonRpcPeticion<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params?: T;
}

interface MessageSendParams {
  readonly message?: A2aMessageDto;
  readonly taskId?: string;
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
 * Controlador A2A v1.0 para el especialista de conocimiento (HU-29, HU-30).
 *
 * Atiende mensajes JSON-RPC 2.0 en `POST /a2a`, delega la busqueda de politica y
 * retorna el artefacto estructurado `politica_aplicable` (doc 03 §3.1, §4.1).
 */
@Controller()
export class A2aController {
  private readonly logger = new Logger(A2aController.name);

  constructor(private readonly knowledgeLookupService: KnowledgeLookupService) {}

  @Post(RUTA_A2A.slice(1))
  @HttpCode(HttpStatus.OK)
  async atenderMensaje(
    @Body() peticion: JsonRpcPeticion<MessageSendParams>,
    @Headers(CABECERA_TRACE_ID) trazaCabecera?: string,
  ): Promise<JsonRpcRespuesta<A2aTaskDto>> {
    const inicio = ahoraMonotonoMs();
    const reqId = peticion?.id ?? 'req-desconocido';

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
    const taskId =
      peticion.params?.taskId ??
      `task-conocimiento-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const traceId = trazaCabecera ?? mensaje?.metadata?.traceId ?? `trace-a2a-${Date.now()}`;

    // Extraer la consulta de texto de las partes del mensaje
    const parteTexto = mensaje?.parts?.find((p) => p.kind === 'text');
    const consulta = parteTexto && 'text' in parteTexto ? parteTexto.text : '';

    if (!consulta.trim()) {
      return {
        jsonrpc: '2.0',
        id: reqId,
        result: {
          id: taskId,
          status: 'failed',
          messages: [],
          artifacts: [],
        },
      };
    }

    try {
      const resultado = await this.knowledgeLookupService.ejecutarLookup(consulta, traceId);
      const procesamientoMs = ahoraMonotonoMs() - inicio;

      const metadataRespuesta: MetadataMensajeA2aDto = {
        traceId,
        hop: (mensaje?.metadata?.hop ?? 0) + 1,
        emisor: 'b3-a2a-conocimiento',
        receptor: mensaje?.metadata?.emisor ?? 'orquestador',
        t_emision: new Date().toISOString(),
      };

      const respuestaMensaje: A2aMessageDto = {
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text:
              resultado.artefacto.parts[0]?.kind === 'data'
                ? ((resultado.artefacto.parts[0].data as { resumen?: string }).resumen ?? '')
                : '',
          },
        ],
        metadata: metadataRespuesta,
      };

      const tarea: A2aTaskDto = {
        id: taskId,
        status: 'completed',
        messages: [respuestaMensaje],
        artifacts: [resultado.artefacto as A2aArtifactDto],
      };

      this.logger.log(
        `Lookup completado con éxito para tarea «${taskId}» en ${procesamientoMs.toFixed(1)}ms`,
      );

      return {
        jsonrpc: '2.0',
        id: reqId,
        result: tarea,
      };
    } catch (fallo) {
      this.logger.error(`Fallo en lookup de conocimiento: ${(fallo as Error).message}`);
      return {
        jsonrpc: '2.0',
        id: reqId,
        result: {
          id: taskId,
          status: 'failed',
          messages: [
            {
              role: 'agent',
              parts: [
                {
                  kind: 'text',
                  text: `Fallo de infraestructura en especialista de conocimiento: ${(fallo as Error).message}`,
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

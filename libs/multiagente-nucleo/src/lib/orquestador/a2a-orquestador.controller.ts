import { Body, Controller, Headers, HttpCode, Inject, Logger, Post } from '@nestjs/common';
import {
  AtenderTurnoUseCase,
  ErrorApi,
  InstrumentadorTrazas,
  RepositorioConversaciones,
} from '@unihelp/agente-nucleo';
import type {
  A2aTaskDto,
  JsonRpcPeticionDto,
  JsonRpcRespuestaDto,
  MessageSendParamsDto,
} from '@unihelp/contratos';
import {
  CABECERA_TRACE_ID,
  CODIGOS_JSONRPC,
  METODO_A2A_MESSAGE_SEND,
  RUTA_A2A,
} from '@unihelp/contratos';
import { ErrorInfraestructura } from '@unihelp/herramientas';
import { NOMBRE_ARTEFACTO } from '../artefactos/esquemas-artefactos';

/**
 * Entrada A2A del orquestador de B3 (docs/03, 2.3 y 3.1): `POST /a2a` con
 * `message/send`, para un cliente que hable el protocolo en vez del contrato
 * REST. Es la MISMA conversacion que `POST /api/conversaciones/mensajes`
 * (`contextId` es el `conversacionId`): pasa por `AtenderTurnoUseCase` y
 * devuelve la tarea con el estado del ciclo de vida y el artefacto
 * `resultado_triaje`, que es el mismo objeto final que emiten B0 y B1 (HU-30).
 * El ejecutor y el frontend usan REST; este endpoint existe por el protocolo.
 */
@Controller()
export class A2aOrquestadorController {
  private readonly logger = new Logger('A2aOrquestador');

  constructor(
    @Inject(AtenderTurnoUseCase) private readonly atenderTurno: AtenderTurnoUseCase,
    @Inject(InstrumentadorTrazas) private readonly instrumentador: InstrumentadorTrazas,
    @Inject(RepositorioConversaciones) private readonly conversaciones: RepositorioConversaciones,
  ) {}

  @Post(RUTA_A2A.slice(1))
  @HttpCode(200)
  async atender(
    @Body() peticion: JsonRpcPeticionDto<MessageSendParamsDto> | undefined,
    @Headers(CABECERA_TRACE_ID) trazaCabecera: string | undefined,
  ): Promise<JsonRpcRespuestaDto<A2aTaskDto>> {
    const id = peticion?.id ?? 'sin-id';
    if (peticion?.jsonrpc !== '2.0' || peticion.method !== METODO_A2A_MESSAGE_SEND) {
      return error(
        id,
        CODIGOS_JSONRPC.metodoNoSoportado,
        'Método no soportado: se espera «message/send».',
      );
    }
    const mensaje = peticion.params?.message;
    const parte = mensaje?.parts.find((p) => p.kind === 'text');
    const texto = parte && 'text' in parte ? parte.text : '';
    try {
      const respuesta = await this.atenderTurno.ejecutar({
        conversacionId: peticion.params?.contextId ?? null,
        texto,
        traceId: trazaCabecera?.trim() || mensaje?.metadata?.traceId || null,
      });
      const conversacion = this.conversaciones.obtener(respuesta.conversacionId);
      const traceId = conversacion?.traceId ?? respuesta.conversacionId;
      const medicion = this.instrumentador.consultar(traceId);
      const textoFinal = respuesta.respuesta.bloques
        .flatMap((b) => (b.tipo === 'texto' ? [b.texto] : []))
        .join('\n');
      const hops = medicion?.a2a.hops ?? [];
      const objeto = medicion?.objetoFinal ?? null;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          id: medicion?.a2a.taskId ?? `task-${respuesta.conversacionId}`,
          status: medicion?.a2a.estados.at(-1)?.estado ?? 'completed',
          messages: [
            {
              role: 'agent',
              parts: [{ kind: 'text', text: textoFinal }],
              metadata: {
                traceId,
                hop: hops.length + 1,
                emisor: 'orquestador',
                receptor: 'usuario',
                t_emision: new Date().toISOString(),
              },
            },
          ],
          artifacts:
            objeto === null
              ? []
              : [
                  {
                    artifactId: 'resultado_triaje',
                    name: NOMBRE_ARTEFACTO.resultado_triaje,
                    parts: [
                      { kind: 'text', text: textoFinal },
                      {
                        kind: 'data',
                        data: {
                          ...objeto,
                          agentes_consultados: [...new Set(hops.map((h) => h.habilidad))],
                        },
                      },
                    ],
                  },
                ],
          metadata: { 'unihelp/contextId': respuesta.conversacionId },
        },
      };
    } catch (fallo) {
      if (fallo instanceof ErrorApi) {
        return error(id, CODIGOS_JSONRPC.parametrosInvalidos, fallo.message);
      }
      if (fallo instanceof ErrorInfraestructura) {
        this.logger.warn(fallo.message);
        return error(id, CODIGOS_JSONRPC.infraestructura, fallo.message, {
          tipo: 'infraestructura',
        });
      }
      this.logger.error(fallo instanceof Error ? (fallo.stack ?? fallo.message) : String(fallo));
      return error(id, CODIGOS_JSONRPC.interno, 'Fallo interno del orquestador.');
    }
  }
}

function error(
  id: string | number,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcRespuestaDto<A2aTaskDto> {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

import { randomUUID } from 'node:crypto';
import { Body, Controller, Headers, HttpCode, Inject, Logger, Post } from '@nestjs/common';
import type {
  A2aTaskDto,
  JsonRpcPeticionDto,
  JsonRpcRespuestaDto,
  MessageSendParamsDto,
  SolicitudEspecialistaDto,
} from '@unihelp/contratos';
import {
  CABECERA_TRACE_ID,
  CODIGOS_JSONRPC,
  HABILIDADES_A2A,
  METODO_A2A_MESSAGE_SEND,
  RUTA_A2A,
} from '@unihelp/contratos';
import { ErrorInfraestructura } from '@unihelp/herramientas';
import { AgenteEspecialista } from './agente-especialista';

export const AGENTE_ESPECIALISTA = Symbol('AGENTE_ESPECIALISTA');

/**
 * Lado servidor del transporte A2A de un especialista (B3): `POST /a2a` con
 * JSON-RPC 2.0 y `message/send` (docs/03, 3.1). Desempaqueta la solicitud del
 * `DataPart`, se la pasa al agente y devuelve la tarea con el artefacto y la
 * medicion. Es SOLO transporte: no decide nada del triaje. Un fallo de
 * infraestructura del especialista (modelo, MCP) vuelve como error JSON-RPC
 * `infraestructura`, que el orquestador traduce a `ErrorInfraestructura` para
 * que la ejecucion termine como `error_infraestructura` (RM-15).
 */
@Controller()
export class A2aEspecialistaController {
  private readonly logger = new Logger('A2aEspecialista');

  constructor(@Inject(AGENTE_ESPECIALISTA) private readonly agente: AgenteEspecialista) {}

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
    const parte = mensaje?.parts.find((p) => p.kind === 'data');
    const solicitud =
      parte && 'data' in parte ? (parte.data as Partial<SolicitudEspecialistaDto>) : null;
    if (
      solicitud === null ||
      !(HABILIDADES_A2A as readonly string[]).includes(String(solicitud.habilidad)) ||
      typeof solicitud.entrada !== 'object' ||
      solicitud.entrada === null
    ) {
      return error(
        id,
        CODIGOS_JSONRPC.parametrosInvalidos,
        'El mensaje debe traer un DataPart con «habilidad» y «entrada».',
      );
    }
    const metadata = mensaje?.metadata;
    const traceId = trazaCabecera?.trim() || metadata?.traceId || `a2a-${randomUUID()}`;
    try {
      const tarea = await this.agente.atender({
        habilidad: solicitud.habilidad as SolicitudEspecialistaDto['habilidad'],
        entrada: solicitud.entrada as Record<string, unknown>,
        traceId,
        conversacionId: peticion.params?.contextId ?? traceId,
        tiempoRestanteMs:
          typeof metadata?.tiempo_restante_ms === 'number' ? metadata.tiempo_restante_ms : null,
        hop: metadata?.hop ?? 1,
      });
      return { jsonrpc: '2.0', id, result: tarea };
    } catch (fallo) {
      if (fallo instanceof ErrorInfraestructura) {
        this.logger.warn(fallo.message);
        return error(id, CODIGOS_JSONRPC.infraestructura, fallo.message, {
          tipo: 'infraestructura',
        });
      }
      this.logger.error(fallo instanceof Error ? (fallo.stack ?? fallo.message) : String(fallo));
      return error(id, CODIGOS_JSONRPC.interno, 'Fallo interno del especialista.');
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

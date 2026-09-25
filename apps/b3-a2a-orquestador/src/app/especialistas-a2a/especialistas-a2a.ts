import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  A2aTaskDto,
  JsonRpcPeticionDto,
  JsonRpcRespuestaDto,
  MessageSendParamsDto,
  SolicitudEspecialistaDto,
} from '@unihelp/contratos';
import { CABECERA_TRACE_ID, METODO_A2A_MESSAGE_SEND } from '@unihelp/contratos';
import { ErrorInfraestructura, ahoraMonotonoMs } from '@unihelp/herramientas';
import {
  ESPECIALISTA_DE_HABILIDAD,
  type PuertoEspecialistas,
  type ResultadoDelegacion,
  type SolicitudDelegacion,
} from '@unihelp/multiagente-nucleo';
import { RegistroA2aService } from '../registro-a2a/registro-a2a.service';

/** Margen sobre el presupuesto del orquestador para que el HTTP no corte antes que el especialista. */
const MARGEN_HTTP_MS = 5_000;
/** Si el orquestador no dijo cuanto le queda, el HTTP espera esto (RNF-04: 120 s por conversacion). */
const ESPERA_HTTP_POR_DEFECTO_MS = 125_000;

/** El especialista no respondio o rompio el protocolo: `error_infraestructura`, nunca un diagnostico inventado (RM-15). */
export class ErrorInfraestructuraA2a extends ErrorInfraestructura {}

/**
 * Implementacion A2A del puerto de especialistas: la UNICA pieza de B3 que no es
 * el nucleo multiagente compartido, y la unica diferencia con B2 (H3, RNF-01).
 *
 * - Resuelve al especialista por `skills[].id` en el registro de descubrimiento
 *   (HU-29): ninguna URL vive aqui ni en el prompt.
 * - Envia `message/send` (JSON-RPC 2.0 sobre HTTP, docs/03, 3.1) con la
 *   solicitud como `DataPart`, la traza en la cabecera `X-Trace-Id` y en la
 *   metadata del mensaje (HU-33) y el presupuesto restante para que el
 *   especialista no trabaje de mas (RNF-04).
 * - Mide la ida y vuelta con reloj monotono; la duracion del receptor viaja en
 *   la tarea y el instrumentador del nucleo hace la resta (D5, RM-05).
 * - Si el especialista no responde, responde HTTP de error o un error JSON-RPC
 *   (incluido el de infraestructura), lanza `ErrorInfraestructura`: la
 *   ejecucion termina como `error_infraestructura` (RM-15; docs/03, 7).
 */
@Injectable()
export class EspecialistasA2a implements PuertoEspecialistas {
  private readonly logger = new Logger('EspecialistasA2a');

  constructor(@Inject(RegistroA2aService) private readonly registro: RegistroA2aService) {}

  async delegar(solicitud: SolicitudDelegacion): Promise<ResultadoDelegacion> {
    const receptor = ESPECIALISTA_DE_HABILIDAD[solicitud.habilidad];
    const tarjeta = await this.registro.resolver(solicitud.habilidad);
    if (tarjeta === undefined) {
      throw new ErrorInfraestructuraA2a(
        `No hay ningún especialista registrado para «${solicitud.habilidad}» (${receptor}).`,
      );
    }
    const datos: SolicitudEspecialistaDto = {
      habilidad: solicitud.habilidad,
      entrada: solicitud.entrada,
    };
    const tEmision = new Date().toISOString();
    const cuerpo: JsonRpcPeticionDto<MessageSendParamsDto> = {
      jsonrpc: '2.0',
      id: randomUUID(),
      method: METODO_A2A_MESSAGE_SEND,
      params: {
        contextId: solicitud.conversacionId,
        message: {
          role: 'user',
          parts: [{ kind: 'data', data: datos }],
          metadata: {
            traceId: solicitud.traceId,
            hop: 1,
            emisor: 'orquestador',
            receptor,
            t_emision: tEmision,
            ...(solicitud.tiempoRestanteMs === null
              ? {}
              : { tiempo_restante_ms: Math.max(0, Math.floor(solicitud.tiempoRestanteMs)) }),
          },
        },
      },
    };
    const espera =
      solicitud.tiempoRestanteMs === null
        ? ESPERA_HTTP_POR_DEFECTO_MS
        : Math.max(1, Math.floor(solicitud.tiempoRestanteMs)) + MARGEN_HTTP_MS;

    const inicio = ahoraMonotonoMs();
    let respuesta: Response;
    let json: JsonRpcRespuestaDto<A2aTaskDto>;
    try {
      respuesta = await fetch(tarjeta.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          [CABECERA_TRACE_ID]: solicitud.traceId,
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(espera),
      });
      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
      }
      json = (await respuesta.json()) as JsonRpcRespuestaDto<A2aTaskDto>;
    } catch (fallo) {
      const detalle = fallo instanceof Error ? fallo.message : String(fallo);
      throw new ErrorInfraestructuraA2a(
        `El especialista «${tarjeta.name}» (${tarjeta.url}) no respondió a message/send: ${detalle}`,
      );
    }
    const rttMs = ahoraMonotonoMs() - inicio;
    const tRecepcion = new Date().toISOString();

    if (json.error !== undefined || json.result === undefined) {
      // Un error del protocolo (metodo, parametros, infraestructura del
      // especialista) no es una respuesta de la arquitectura: se excluye (RM-15).
      throw new ErrorInfraestructuraA2a(
        `El especialista «${tarjeta.name}» respondió con error JSON-RPC ${json.error?.code ?? '?'}: ${
          json.error?.message ?? 'sin result'
        }`,
      );
    }
    this.logger.log(
      `${solicitud.habilidad} -> ${tarjeta.name}: ${json.result.status} en ${rttMs.toFixed(1)} ms (traza ${solicitud.traceId})`,
    );
    return { tarea: json.result, rttMs, tEmision, tRecepcion };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { ContextoInvocacion } from '@unihelp/herramientas';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ClienteModelo } from '../modelo/cliente-modelo';
import { ErrorTiempoAgotado } from '../modelo/errores-modelo';
import { RegistroCapacidades } from '../herramientas/registro-capacidades';
import { TransporteHerramientasLocal } from '../herramientas/transporte-herramientas-local';
import { InstrumentadorTrazas } from './instrumentador-trazas';
import { PresupuestoEjecucion } from './presupuesto-ejecucion';

/** Una herramienta invocada en el turno, con su resultado estructurado. */
export interface LlamadaDelTurno {
  readonly nombre: string;
  readonly ok: boolean;
  readonly estructurado: unknown;
}

export type MotivoFin = 'respuesta' | 'timeout' | 'limite_herramientas';

export interface ResultadoBucle {
  readonly motivo: MotivoFin;
  /** Contenido del ultimo mensaje del modelo; `null` si se corto antes. */
  readonly contenidoFinal: string | null;
  /** Mensajes a agregar al historial: los del asistente y los de rol de herramienta. */
  readonly mensajesNuevos: readonly ChatCompletionMessageParam[];
  readonly llamadas: readonly LlamadaDelTurno[];
}

function parsearArgumentos(crudo: string): Record<string, unknown> | string {
  try {
    const valor: unknown = JSON.parse(crudo);
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : crudo;
  } catch {
    return crudo;
  }
}

/**
 * Bucle de function calling de B0. El MODELO decide que herramienta invocar,
 * en que orden y con que argumentos (HU-02; seccion 8 de la arquitectura). El
 * bucle no clasifica, no valida argumentos, no sanea y no decide prioridades:
 * todo eso ocurre del lado del receptor, igual que en B1.
 *
 * Las herramientas se ejecutan de a una, en el orden emitido (D1). El resultado
 * vuelve en el ROL DE HERRAMIENTA, nunca pegado al mensaje de la persona (capa 1
 * de la defensa ante inyeccion).
 */
@Injectable()
export class BucleAgente {
  constructor(
    @Inject(ClienteModelo) private readonly modelo: ClienteModelo,
    @Inject(RegistroCapacidades) private readonly registro: RegistroCapacidades,
    @Inject(TransporteHerramientasLocal) private readonly transporte: TransporteHerramientasLocal,
    @Inject(PresupuestoEjecucion) private readonly presupuesto: PresupuestoEjecucion,
    @Inject(InstrumentadorTrazas) private readonly instrumentador: InstrumentadorTrazas,
  ) {}

  async atender(
    historial: readonly ChatCompletionMessageParam[],
    contexto: ContextoInvocacion,
    inicioTurno: number,
  ): Promise<ResultadoBucle> {
    const nuevos: ChatCompletionMessageParam[] = [];
    const llamadas: LlamadaDelTurno[] = [];
    const cortar = (motivo: MotivoFin): ResultadoBucle => ({
      motivo,
      contenidoFinal: null,
      mensajesNuevos: nuevos,
      llamadas,
    });

    for (;;) {
      const restante = this.presupuesto.restanteMs(contexto.traceId, inicioTurno);
      if (restante <= 0) {
        return cortar('timeout');
      }
      let respuesta;
      try {
        respuesta = await this.modelo.completar(
          [...historial, ...nuevos],
          this.registro.definiciones,
          restante,
        );
      } catch (fallo) {
        if (fallo instanceof ErrorTiempoAgotado) {
          return cortar('timeout');
        }
        throw fallo;
      }
      this.instrumentador.registrarModelo(contexto.traceId, respuesta.rttMs, respuesta.consumo);

      const { mensaje } = respuesta;
      const pedidas = (mensaje.tool_calls ?? []).filter((t) => t.type === 'function');
      nuevos.push({
        role: 'assistant',
        content: mensaje.content ?? null,
        ...(pedidas.length > 0 ? { tool_calls: pedidas } : {}),
      });
      if (pedidas.length === 0) {
        return {
          motivo: 'respuesta',
          contenidoFinal: mensaje.content ?? '',
          mensajesNuevos: nuevos,
          llamadas,
        };
      }

      let limiteAlcanzado = false;
      for (const pedida of pedidas) {
        if (limiteAlcanzado) {
          // Toda llamada pedida necesita su respuesta en el historial, aunque no se ejecute.
          nuevos.push({
            role: 'tool',
            tool_call_id: pedida.id,
            content: JSON.stringify({
              error: { codigo: 'LIMITE_EXCEDIDO', mensaje: 'No se ejecutó: se alcanzó el límite.' },
            }),
          });
          continue;
        }
        const seq = this.instrumentador.siguienteSeq(contexto.traceId);
        const args = parsearArgumentos(pedida.function.arguments);
        const resultado = await this.transporte.invocar(pedida.function.name, args, contexto);
        this.instrumentador.registrarHerramienta(
          contexto.traceId,
          {
            seq,
            nombre: pedida.function.name,
            args: typeof args === 'string' ? { _crudo: args } : args,
            isError: !resultado.ok,
            resultado_status: resultado.ok ? 'ok' : resultado.error.codigo,
            resultado: resultado.ok ? resultado.salida.estructurado : null,
            latency_ms: resultado.rttMs,
          },
          resultado.durMs,
        );
        llamadas.push({
          nombre: pedida.function.name,
          ok: resultado.ok,
          estructurado: resultado.ok ? resultado.salida.estructurado : null,
        });
        nuevos.push({
          role: 'tool',
          tool_call_id: pedida.id,
          content: JSON.stringify(
            resultado.ok
              ? resultado.salida.paraModelo
              : { error: { codigo: resultado.error.codigo, mensaje: resultado.error.message } },
          ),
        });
        if (!resultado.ok && resultado.error.codigo === 'LIMITE_EXCEDIDO') {
          limiteAlcanzado = true;
        }
      }
      if (limiteAlcanzado) {
        return cortar('limite_herramientas');
      }
    }
  }
}

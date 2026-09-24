import { Inject, Injectable } from '@nestjs/common';
import { ahoraMonotonoMs } from '@unihelp/herramientas';
import OpenAI from 'openai';
import type {
  ChatCompletionCreateParams,
  ChatCompletion,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionFunctionTool,
} from 'openai/resources/chat/completions';
import { CONFIGURACION_B0, type ConfiguracionB0 } from '../configuracion/configuracion-b0';
import { CaseteModelo, claveCasete } from './casete-modelo';
import { ErrorInfraestructuraModelo, ErrorTiempoAgotado } from './errores-modelo';

/** Consumo que reporta el proveedor, sin corregir nada. */
export interface ConsumoModelo {
  readonly entrada: number;
  readonly salida: number;
  /** OpenAI cachea prompts largos de forma automatica y no se puede desactivar (D2): se registra siempre. */
  readonly cacheados: number;
}

export interface RespuestaModelo {
  readonly mensaje: ChatCompletionMessage;
  readonly consumo: ConsumoModelo;
  /** Ida y vuelta de la peticion, medido aqui, en el cliente que la emite (M4.2). */
  readonly rttMs: number;
}

/**
 * Hace UNA peticion al modelo. Sin reintentos automaticos: un reintento
 * escondido mezclaria dos peticiones en un solo `rtt` (M4.2). Nunca pide
 * paralelismo de herramientas (D1).
 */
@Injectable()
export class ClienteModelo {
  private readonly cliente: OpenAI | null;

  constructor(
    @Inject(CONFIGURACION_B0) private readonly configuracion: ConfiguracionB0,
    @Inject(CaseteModelo) private readonly casete: CaseteModelo,
  ) {
    this.cliente =
      configuracion.claveApi === null
        ? null
        : new OpenAI({ apiKey: configuracion.claveApi, maxRetries: 0 });
  }

  /** `modeloId` lo decide `ConfiguracionModeloRuntime`: la interfaz en desarrollo, la configuracion en una corrida. */
  async completar(
    mensajes: readonly ChatCompletionMessageParam[],
    herramientas: readonly ChatCompletionFunctionTool[],
    tiempoRestanteMs: number,
    modeloId: string,
  ): Promise<RespuestaModelo> {
    const { modelo } = this.configuracion;
    const clave = claveCasete({
      model: modeloId,
      messages: mensajes,
      tools: herramientas.map((h) => h.function.name),
      temperature: modelo.temperatura,
      reasoning_effort: modelo.esfuerzoRazonamiento,
    });

    const inicio = ahoraMonotonoMs();
    const respuesta =
      this.casete.modo === 'replay'
        ? this.casete.leer(clave)
        : await this.pedir(mensajes, herramientas, tiempoRestanteMs, modeloId);
    const rttMs = ahoraMonotonoMs() - inicio;

    if (this.casete.modo === 'record') {
      this.casete.guardar(clave, respuesta);
    }
    const eleccion = respuesta.choices[0];
    if (eleccion === undefined) {
      throw new ErrorInfraestructuraModelo('El proveedor respondió sin ninguna opción.');
    }
    return {
      mensaje: eleccion.message,
      consumo: {
        entrada: respuesta.usage?.prompt_tokens ?? 0,
        salida: respuesta.usage?.completion_tokens ?? 0,
        cacheados: respuesta.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      },
      rttMs,
    };
  }

  private async pedir(
    mensajes: readonly ChatCompletionMessageParam[],
    herramientas: readonly ChatCompletionFunctionTool[],
    tiempoRestanteMs: number,
    modeloId: string,
  ): Promise<ChatCompletion> {
    if (this.cliente === null) {
      throw new ErrorInfraestructuraModelo('No hay clave del proveedor configurada.');
    }
    const { modelo } = this.configuracion;
    const senal = AbortSignal.timeout(Math.max(1, Math.floor(tiempoRestanteMs)));
    try {
      return await this.cliente.chat.completions.create(
        {
          model: modeloId,
          messages: [...mensajes],
          tools: [...herramientas],
          tool_choice: 'auto',
          parallel_tool_calls: false,
          // Explicito: en GPT-5.x el valor por defecto no es `none` y con otro
          // valor el proveedor rechaza `temperature` y las herramientas (decision 40).
          // El tipo del SDK 5.23 aun no lista `none`, que la API si acepta.
          reasoning_effort:
            modelo.esfuerzoRazonamiento as ChatCompletionCreateParams['reasoning_effort'],
          temperature: modelo.temperatura,
          top_p: modelo.topP,
          max_completion_tokens: modelo.maxTokens,
        },
        { signal: senal },
      );
    } catch (fallo) {
      if (senal.aborted) {
        throw new ErrorTiempoAgotado();
      }
      const detalle = fallo instanceof Error ? fallo.message : String(fallo);
      throw new ErrorInfraestructuraModelo(`Falla del proveedor del modelo: ${detalle}`);
    }
  }
}

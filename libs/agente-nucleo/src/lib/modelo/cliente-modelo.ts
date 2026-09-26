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
import {
  CONFIGURACION_AGENTE,
  type ConfiguracionAgente,
} from '../configuracion/configuracion-agente';
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

/** Modelos que aceptan `reasoning_effort`: la familia GPT-5 y la serie o (`o3`, `o4-mini`). */
export function admiteRazonamiento(modeloId: string): boolean {
  return /^(gpt-5|o\d)/.test(modeloId);
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
    @Inject(CONFIGURACION_AGENTE) private readonly configuracion: ConfiguracionAgente,
    @Inject(CaseteModelo) private readonly casete: CaseteModelo,
  ) {
    // `baseURL` solo cambia con un proveedor local (Ollama, decision 46); la
    // peticion es la misma API de Chat Completions.
    this.cliente =
      configuracion.claveApi === null
        ? null
        : new OpenAI({
            apiKey: configuracion.claveApi,
            maxRetries: 0,
            ...(configuracion.modelo.urlBase === null
              ? {}
              : { baseURL: configuracion.modelo.urlBase }),
          });
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
          // El tipo del SDK 5.23 aun no lista `none`, que la API si acepta. Un
          // modelo sin razonamiento (gpt-4.1) rechaza el parametro: no se envia.
          ...(admiteRazonamiento(modeloId)
            ? {
                reasoning_effort:
                  modelo.esfuerzoRazonamiento as ChatCompletionCreateParams['reasoning_effort'],
              }
            : {}),
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

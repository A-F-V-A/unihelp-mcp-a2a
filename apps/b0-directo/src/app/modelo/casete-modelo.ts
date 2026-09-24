import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { CONFIGURACION_B0, type ConfiguracionB0 } from '../configuracion/configuracion-b0';
import { ErrorInfraestructuraModelo } from './errores-modelo';

/** Lo que identifica una peticion al modelo para grabarla o reproducirla. */
export interface PeticionCanonica {
  readonly model: string;
  readonly messages: unknown;
  readonly tools: readonly string[];
  readonly temperature: number;
  /** Solo entra en la clave si no es `none`, para que los casetes ya grabados sigan valiendo. */
  readonly reasoning_effort?: string;
}

/** Clave de docs/05, seccion 4: modelo, mensajes, nombres de herramientas ordenados y temperatura. */
export function claveCasete(peticion: PeticionCanonica): string {
  const canon = JSON.stringify({
    model: peticion.model,
    messages: peticion.messages,
    tools: [...peticion.tools].sort(),
    temperature: peticion.temperature,
    ...(peticion.reasoning_effort && peticion.reasoning_effort !== 'none'
      ? { reasoning_effort: peticion.reasoning_effort }
      : {}),
  });
  return createHash('sha256').update(canon, 'utf8').digest('hex');
}

/**
 * Graba o reproduce las respuestas del modelo (HU-39). En `replay` NUNCA llama
 * al proveedor: una peticion sin grabacion es un error explicito.
 */
@Injectable()
export class CaseteModelo {
  constructor(@Inject(CONFIGURACION_B0) private readonly configuracion: ConfiguracionB0) {}

  get modo(): ConfiguracionB0['modoLlm'] {
    return this.configuracion.modoLlm;
  }

  /** Ruta del casete de una peticion; `null` en `live`. */
  ruta(clave: string): string | null {
    const directorio = this.configuracion.directorioCasetes;
    return directorio === null ? null : join(directorio, `${clave}.json`);
  }

  leer(clave: string): ChatCompletion {
    const ruta = this.ruta(clave);
    try {
      return JSON.parse(readFileSync(ruta ?? '', 'utf8')) as ChatCompletion;
    } catch {
      throw new ErrorInfraestructuraModelo(
        `Modo replay: no hay grabación para la petición ${clave} en ${ruta ?? '(sin directorio)'}.`,
      );
    }
  }

  guardar(clave: string, respuesta: ChatCompletion): void {
    const directorio = this.configuracion.directorioCasetes;
    if (directorio === null) {
      return;
    }
    mkdirSync(directorio, { recursive: true });
    writeFileSync(join(directorio, `${clave}.json`), JSON.stringify(respuesta, null, 2), 'utf8');
  }
}

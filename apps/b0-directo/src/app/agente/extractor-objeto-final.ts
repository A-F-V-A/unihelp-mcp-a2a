import { Injectable } from '@nestjs/common';
import { ESQUEMA_OBJETO_FINAL, type ObjetoFinal } from '@unihelp/herramientas';
import Ajv from 'ajv';

export interface RespuestaSeparada {
  /** Lo que se muestra a la persona, sin el bloque JSON. */
  readonly texto: string;
  /** `null` si el modelo no emitio el objeto o no cumple el esquema. No es un error del agente. */
  readonly objeto: ObjetoFinal | null;
}

const BLOQUE_JSON = /```json\s*([\s\S]*?)```/g;

/**
 * Separa la respuesta final del modelo en el texto para la persona y el objeto
 * final estructurado de HU-30 (el mismo `resultado_triaje` de B2 y B3).
 */
@Injectable()
export class ExtractorObjetoFinal {
  private readonly validar = new Ajv({ strict: false }).compile(ESQUEMA_OBJETO_FINAL);

  separar(contenido: string): RespuestaSeparada {
    const bloques = [...contenido.matchAll(BLOQUE_JSON)];
    const ultimo = bloques.at(-1);
    if (ultimo === undefined) {
      return { texto: contenido.trim(), objeto: null };
    }
    const texto = (
      contenido.slice(0, ultimo.index) + contenido.slice((ultimo.index ?? 0) + ultimo[0].length)
    ).trim();
    try {
      const candidato: unknown = JSON.parse(ultimo[1] ?? '');
      return { texto, objeto: this.validar(candidato) ? (candidato as ObjetoFinal) : null };
    } catch {
      return { texto, objeto: null };
    }
  }
}

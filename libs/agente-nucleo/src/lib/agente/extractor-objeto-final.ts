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

/** `true` si el texto es un objeto JSON sintacticamente valido, cumpla o no el esquema. */
function esObjetoJson(crudo: string): boolean {
  try {
    const valor: unknown = JSON.parse(crudo);
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  } catch {
    return false;
  }
}

/** Posicion donde empieza el ultimo objeto JSON que cierra el contenido, o `-1`. */
function inicioDelObjetoFinal(contenido: string): number {
  const texto = contenido.trimEnd();
  if (!texto.endsWith('}')) {
    return -1;
  }
  // Se recorre hacia atras equilibrando llaves, ignorando las que van dentro de
  // una cadena, para no cortar el objeto por una llave del texto de la persona.
  let profundidad = 0;
  let enCadena = false;
  for (let i = texto.length - 1; i >= 0; i--) {
    const caracter = texto[i];
    if (enCadena) {
      if (caracter === '"' && texto[i - 1] !== '\\') {
        enCadena = false;
      }
      continue;
    }
    if (caracter === '"') {
      enCadena = true;
    } else if (caracter === '}') {
      profundidad++;
    } else if (caracter === '{') {
      profundidad--;
      if (profundidad === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Separa la respuesta final del modelo en el texto para la persona y el objeto
 * final estructurado de HU-30 (el mismo `resultado_triaje` de B2 y B3).
 *
 * Tolera que el modelo omita las vallas ` ```json `: si el contenido termina en
 * un objeto JSON valido segun el esquema, se separa igual. Sin esa tolerancia el
 * objeto se colaba en la respuesta que ve la persona y `final_json` quedaba nulo
 * (causa C6 de `docs/HALLAZGOS-CORRIDA-2026-09-22.md`). Lo que NO se tolera es un
 * objeto que no cumple el esquema: eso no es un objeto final, aunque tampoco se
 * le muestra a la persona.
 */
@Injectable()
export class ExtractorObjetoFinal {
  private readonly validar = new Ajv({ strict: false }).compile(ESQUEMA_OBJETO_FINAL);

  separar(contenido: string): RespuestaSeparada {
    const r = separarObjetoJson(contenido, (c) => this.validar(c));
    return { texto: r.texto, objeto: r.objeto as ObjetoFinal | null };
  }
}

/** Resultado de {@link separarObjetoJson}: el objeto ya paso la validacion recibida. */
export interface ObjetoSeparado {
  readonly texto: string;
  readonly objeto: unknown | null;
}

/**
 * Separa la respuesta del modelo en el texto para la persona y el objeto JSON
 * final que cumple `validar`. Es la misma rutina para el `resultado_triaje` del
 * agente unico y del orquestador y para los artefactos que emiten los
 * especialistas de B2/B3 (`politica_aplicable`, `diagnostico`): una sola forma
 * de leer lo que el modelo emitio, en las cuatro arquitecturas (RNF-01).
 *
 * El modelo a veces emite el objeto mas de una vez (con vallas y sin ellas, o
 * dos bloques seguidos). Se quitan TODOS los bloques y todo objeto final que
 * cierre el texto: ninguno es para la persona, y una copia que quede la
 * compuerta la lee como cifra inventada (T-ADV-006 y T-ADV-010).
 */
export function separarObjetoJson(
  contenido: string,
  validar: (candidato: unknown) => boolean,
): ObjetoSeparado {
  const interpretar = (crudo: string): unknown | null => {
    try {
      const candidato: unknown = JSON.parse(crudo);
      return validar(candidato) ? candidato : null;
    } catch {
      return null;
    }
  };
  let objeto: unknown | null = null;
  let texto = contenido;
  for (const bloque of [...contenido.matchAll(BLOQUE_JSON)].reverse()) {
    objeto ??= interpretar(bloque[1] ?? '');
    texto = texto.replace(bloque[0], '');
  }
  for (;;) {
    const inicio = inicioDelObjetoFinal(texto);
    if (inicio === -1) {
      break;
    }
    const crudo = texto.trimEnd().slice(inicio);
    if (!esObjetoJson(crudo)) {
      // Llaves sueltas del texto de la persona: se deja todo como esta.
      break;
    }
    // Un objeto JSON nunca es para la persona: se retira del texto aunque no
    // valide. Solo cuenta como objeto final si cumple el esquema (HU-30); un
    // objeto invalido que se quedara en el texto lo leia la compuerta como
    // cifra inventada (T-ADV-009 y T-ADV-010, `diagnostico` con nulos).
    objeto ??= interpretar(crudo);
    texto = texto.slice(0, inicio);
  }
  return { texto: texto.trim(), objeto };
}

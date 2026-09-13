import { Injectable, inject } from '@angular/core';
import { ErrorBackend } from '../../domain/errors/error-backend';
import { mapearErrorApi } from '../mappers/error.mapper';
import {
  CONFIGURACION_SIMULACION,
  ERRORES_SIMULABLES,
  type ErrorSimulable,
  type OperacionSimulada,
} from './configuracion-simulacion';
import { ERRORES_SIMULADOS, MENSAJE_TIMEOUT } from './fixtures/errores.fixture';

/** Latencia uniforme dentro de `[minima, maxima]` a partir de un aleatorio en `[0, 1)`. */
export function calcularLatencia(aleatorio: number, minima: number, maxima: number): number {
  return Math.round(minima + aleatorio * (maxima - minima));
}

/** Directivas que se pueden escribir en el chat para forzar un fallo: `#timeout`, `#interno`... */
const DIRECTIVA = /#(timeout|validacion|no-disponible|interno)\b/i;

export function leerDirectivaError(texto: string | undefined): ErrorSimulable | null {
  const coincidencia = texto?.match(DIRECTIVA)?.[1]?.toLowerCase();
  if (!coincidencia) {
    return null;
  }
  return coincidencia === 'no-disponible'
    ? 'servicio-no-disponible'
    : (coincidencia as ErrorSimulable);
}

const esperar = (ms: number) =>
  new Promise<void>((resolver) => setTimeout(resolver, Math.max(0, ms)));

/**
 * Hace que la base simulada se comporte como un servidor al otro lado de la
 * red: latencia variable, fallos configurables y respuestas serializadas (lo
 * que sale no comparte referencias con el estado interno, igual que un JSON
 * recibido por HTTP).
 */
@Injectable()
export class SimuladorRed {
  private readonly config = inject(CONFIGURACION_SIMULACION);

  async responder<T>(
    operacion: OperacionSimulada,
    producir: () => T,
    textoUsuario?: string,
  ): Promise<T> {
    const fallo = this.decidirFallo(operacion, textoUsuario);

    if (fallo === 'timeout') {
      await esperar(this.config.esperaTimeoutMs);
      throw new ErrorBackend('timeout', MENSAJE_TIMEOUT, { operacion });
    }

    await esperar(
      calcularLatencia(Math.random(), this.config.latenciaMinimaMs, this.config.latenciaMaximaMs),
    );

    if (fallo) {
      throw mapearErrorApi(ERRORES_SIMULADOS[fallo]);
    }

    const valor = producir();
    // `undefined` (la respuesta vacia de un DELETE) no es JSON: se devuelve tal cual.
    return valor === undefined ? valor : (JSON.parse(JSON.stringify(valor)) as T);
  }

  private decidirFallo(operacion: OperacionSimulada, texto?: string): ErrorSimulable | null {
    const directiva = leerDirectivaError(texto);
    if (directiva) {
      return directiva;
    }

    const forzado = this.config.errorForzado;
    if (forzado && (forzado.operacion === null || forzado.operacion === operacion)) {
      return forzado.codigo;
    }

    if (Math.random() < this.config.probabilidadError) {
      return ERRORES_SIMULABLES[Math.floor(Math.random() * ERRORES_SIMULABLES.length)];
    }

    return null;
  }
}

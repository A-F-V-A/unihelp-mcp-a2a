import { Injectable, Logger } from '@nestjs/common';

/** Una llamada a herramienta tal como la pide `tool_calls[]` de la traza. */
export interface LlamadaInstrumentada {
  readonly seq: number;
  readonly nombre: string;
  /** Exactamente lo que emitio el modelo, antes de validar (M2.3). */
  readonly args: Record<string, unknown>;
  readonly isError: boolean;
  /** `ok` o el codigo de docs/02, 5. */
  readonly resultado_status: string;
  /** Resultado sin sanear (M3.1). */
  readonly resultado: unknown;
  readonly latency_ms: number;
  readonly agente: 'b0-directo';
  readonly transporte: 'directo';
}

/** Acumulado de una ejecucion. Nombres y unidades de `experiment/schemas/traza.schema.json`. */
export interface MedicionesEjecucion {
  totalMs: number;
  llmMs: number;
  toolExecMs: number;
  transportMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  llmCalls: number;
  toolCalls: LlamadaInstrumentada[];
  /**
   * Como termino cada turno, en orden. El ejecutor lo traduce a `outcome.status`:
   * sin esto tendria que adivinarlo del texto del aviso de corte, que es
   * lenguaje natural y puede cambiar (HU-04).
   */
  motivos: string[];
  /**
   * Objeto final del ultimo turno que lo emitio (HU-30). Es el artefacto contra
   * el que la compuerta automatica verifica politicas citadas y clasificacion
   * (docs/04, seccion 4); `null` si el modelo nunca lo emitio o no valido.
   */
  objetoFinal: Record<string, unknown> | null;
}

/**
 * Acumula las mediciones de cada ejecucion (HU-34). Todas las duraciones llegan
 * medidas con reloj monotono (D6). El residuo de orquestacion se reporta SIN
 * corregir: un residuo negativo es un defecto de instrumentacion que debe verse
 * (M4.2, HU-MET-07). No calcula metricas (RM-02).
 *
 * DP-09 se resolvio asi: B0 NO arma ni persiste la `TrazaEjecucion`, porque la
 * identidad de la tarea, la repeticion y la huella del estado son del ejecutor.
 * B0 expone lo acumulado en `GET /experimento/trazas/:traceId` y el ejecutor
 * arma la traza completa y la valida antes de persistirla (decision 32).
 */
@Injectable()
export class InstrumentadorTrazas {
  private readonly logger = new Logger('Instrumentacion');
  private readonly mediciones = new Map<string, MedicionesEjecucion>();

  de(traceId: string): MedicionesEjecucion {
    let medicion = this.mediciones.get(traceId);
    if (medicion === undefined) {
      medicion = {
        totalMs: 0,
        llmMs: 0,
        toolExecMs: 0,
        transportMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        llmCalls: 0,
        toolCalls: [],
        motivos: [],
        objetoFinal: null,
      };
      this.mediciones.set(traceId, medicion);
    }
    return medicion;
  }

  registrarModelo(
    traceId: string,
    rttMs: number,
    consumo: { entrada: number; salida: number; cacheados: number },
  ): void {
    const m = this.de(traceId);
    m.llmMs += rttMs;
    m.inputTokens += consumo.entrada;
    m.outputTokens += consumo.salida;
    m.cachedInputTokens += consumo.cacheados;
    m.llmCalls += 1;
  }

  /** Lo acumulado de una ejecucion, o `undefined` si B0 nunca la vio (HU-34, DP-09). */
  consultar(traceId: string): MedicionesEjecucion | undefined {
    return this.mediciones.get(traceId);
  }

  registrarObjetoFinal(traceId: string, objeto: Record<string, unknown> | null): void {
    if (objeto !== null) {
      this.de(traceId).objetoFinal = objeto;
    }
  }

  siguienteSeq(traceId: string): number {
    return this.de(traceId).toolCalls.length + 1;
  }

  registrarHerramienta(
    traceId: string,
    llamada: Omit<LlamadaInstrumentada, 'agente' | 'transporte'>,
    durMs: number,
  ): void {
    const m = this.de(traceId);
    m.toolExecMs += durMs;
    m.transportMs += llamada.latency_ms - durMs;
    m.toolCalls.push({ ...llamada, agente: 'b0-directo', transporte: 'directo' });
  }

  cerrarTurno(traceId: string, duracionMs: number, motivo: string): void {
    const m = this.de(traceId);
    m.totalMs += duracionMs;
    m.motivos.push(motivo);
    const residuo = m.totalMs - m.llmMs - m.toolExecMs - m.transportMs;
    this.logger.log(
      `[${traceId}] fin=${motivo} total=${m.totalMs.toFixed(1)}ms llm=${m.llmMs.toFixed(1)} tool=${m.toolExecMs.toFixed(1)} ` +
        `transporte=${m.transportMs.toFixed(2)} orquestacion=${residuo.toFixed(1)} ` +
        `tokens=${m.inputTokens}/${m.outputTokens} (cacheados ${m.cachedInputTokens}) ` +
        `llamadasModelo=${m.llmCalls} herramientas=${m.toolCalls.length}`,
    );
    if (residuo < 0) {
      this.logger.warn(
        `[${traceId}] residuo de orquestacion NEGATIVO: defecto de instrumentacion.`,
      );
    }
  }

  olvidar(traceId: string): void {
    this.mediciones.delete(traceId);
  }

  /** Olvida todas las ejecuciones. Solo lo usa el restablecimiento del experimento. */
  olvidarTodo(): void {
    this.mediciones.clear();
  }
}

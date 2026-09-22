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
}

/**
 * Acumula las mediciones de cada ejecucion (HU-34). Todas las duraciones llegan
 * medidas con reloj monotono (D6). El residuo de orquestacion se reporta SIN
 * corregir: un residuo negativo es un defecto de instrumentacion que debe verse
 * (M4.2, HU-MET-07). No calcula metricas (RM-02).
 *
 * Pendiente DP-09: armar y persistir la `TrazaEjecucion` con `PersistidorTrazas`
 * requiere la identidad de la tarea y la huella del estado, que da el ejecutor.
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

  cerrarTurno(traceId: string, duracionMs: number): void {
    const m = this.de(traceId);
    m.totalMs += duracionMs;
    const residuo = m.totalMs - m.llmMs - m.toolExecMs - m.transportMs;
    this.logger.log(
      `[${traceId}] total=${m.totalMs.toFixed(1)}ms llm=${m.llmMs.toFixed(1)} tool=${m.toolExecMs.toFixed(1)} ` +
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
}

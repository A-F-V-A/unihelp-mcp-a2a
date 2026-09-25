import { Inject, Injectable, Logger } from '@nestjs/common';
import type { EstadoTareaA2a, EstadoTareaA2aDto, SaltoA2aDto } from '@unihelp/contratos';
import type { DelegacionRegistrada } from '@unihelp/herramientas';
import { IDENTIDAD_AGENTE, type IdentidadAgente } from '../identidad-agente';

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
  /** Agente que emitio la llamada (`b0-directo`, `b1-mcp-agente`, `orquestador`, `conocimiento`). */
  readonly agente: string;
  /** Protocolo por el que viajo (`directo`, `mcp`, `a2a`, `en-proceso`). */
  readonly transporte: string;
}

/** `a2a` de la traza, acumulado por el orquestador; vacio en el agente unico (M4.5). */
export interface MensajeriaAcumulada {
  taskId: string | null;
  mensajesTotales: number;
  estados: EstadoTareaA2aDto[];
  hops: SaltoA2aDto[];
  artefactos: string[];
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
  a2a: MensajeriaAcumulada;
}

/**
 * Acumula las mediciones de cada ejecucion (HU-34). Todas las duraciones llegan
 * medidas con reloj monotono (D6). El residuo de orquestacion se reporta SIN
 * corregir: un residuo negativo es un defecto de instrumentacion que debe verse
 * (M4.2, HU-MET-07). No calcula metricas (RM-02).
 *
 * DP-09 se resolvio asi: el agente NO arma ni persiste la `TrazaEjecucion`, porque la
 * identidad de la tarea, la repeticion y la huella del estado son del ejecutor.
 * Expone lo acumulado en `GET /experimento/trazas/:traceId` y el ejecutor
 * arma la traza completa y la valida antes de persistirla (decision 32).
 *
 * En B2 y B3 el orquestador ademas FUSIONA lo que cada especialista midio de si
 * mismo (`registrarDelegacion`): la traza de la ejecucion es una sola, con el
 * consumo de todos los agentes y las llamadas de cada uno firmadas con su
 * `agente`, como pide `docs/05` (decision 44).
 */
@Injectable()
export class InstrumentadorTrazas {
  private readonly logger = new Logger('Instrumentacion');
  private readonly mediciones = new Map<string, MedicionesEjecucion>();

  constructor(@Inject(IDENTIDAD_AGENTE) private readonly identidad: IdentidadAgente) {}

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
        a2a: { taskId: null, mensajesTotales: 0, estados: [], hops: [], artefactos: [] },
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

  /** Lo acumulado de una ejecucion, o `undefined` si este agente nunca la vio (HU-34, DP-09). */
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

  /** `transporte` solo cuando la invocacion viajo por otro protocolo que el del agente (orquestador de B2/B3). */
  registrarHerramienta(
    traceId: string,
    llamada: Omit<LlamadaInstrumentada, 'agente' | 'transporte'>,
    durMs: number,
    transporte: string = this.identidad.protocolo,
  ): void {
    const m = this.de(traceId);
    m.toolExecMs += durMs;
    m.transportMs += llamada.latency_ms - durMs;
    m.toolCalls.push({ ...llamada, agente: this.identidad.agente, transporte });
  }

  /**
   * Una llamada que fue una delegacion a otro agente (B2 y B3). La llamada
   * queda en `tool_calls[]` firmada por este agente con el transporte del
   * salto; lo que el receptor midio de si mismo se SUMA a esta ejecucion:
   * su consumo, sus tiempos y sus llamadas (renumeradas a continuacion). El
   * transporte del salto es `rtt - duracion_ms` del receptor (D5, RM-05), y la
   * duracion del receptor NO entra en `tool_exec_ms` porque ya esta repartida
   * en su propio `llm_ms`, `tool_exec_ms`, `transport_ms` y residuo: sumarla
   * otra vez haria negativa la resta de orquestacion (HU-MET-07).
   */
  registrarDelegacion(
    traceId: string,
    llamada: Omit<LlamadaInstrumentada, 'agente' | 'transporte'>,
    delegacion: DelegacionRegistrada,
  ): void {
    const m = this.de(traceId);
    const { medicion, salto } = delegacion;
    const transporteSalto = llamada.latency_ms - medicion.duracion_ms;
    m.toolCalls.push({
      ...llamada,
      agente: this.identidad.agente,
      transporte: delegacion.transporte,
    });
    for (const remota of medicion.tool_calls) {
      m.toolCalls.push({ ...remota, args: { ...remota.args }, seq: m.toolCalls.length + 1 });
    }
    m.llmMs += medicion.llm_ms;
    m.toolExecMs += medicion.tool_exec_ms;
    m.transportMs += medicion.transport_ms + transporteSalto;
    m.inputTokens += medicion.usage.input_tokens;
    m.outputTokens += medicion.usage.output_tokens;
    m.cachedInputTokens += medicion.usage.cached_input_tokens;
    m.llmCalls += medicion.usage.llm_calls;
    // Solicitud y respuesta: dos mensajes por delegacion, en proceso o por red (M4.5).
    m.a2a.mensajesTotales += 2;
    m.a2a.hops.push({ ...salto, n: m.a2a.hops.length + 1, transport_ms: transporteSalto });
    for (const artefacto of delegacion.artefactos) {
      if (!m.a2a.artefactos.includes(artefacto)) {
        m.a2a.artefactos.push(artefacto);
      }
    }
  }

  /** Transicion del ciclo de vida de la tarea del orquestador (docs/03, 3). Solo la usa el orquestador. */
  registrarEstado(traceId: string, taskId: string, estado: EstadoTareaA2a): void {
    const m = this.de(traceId);
    m.a2a.taskId ??= taskId;
    m.a2a.estados.push({ estado, t: new Date().toISOString() });
  }

  /** El orquestador emitio el artefacto final de la ejecucion (docs/03, 4.3). */
  registrarArtefacto(traceId: string, artefacto: string): void {
    const m = this.de(traceId);
    if (!m.a2a.artefactos.includes(artefacto)) {
      m.a2a.artefactos.push(artefacto);
    }
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
        `llamadasModelo=${m.llmCalls} herramientas=${m.toolCalls.length}` +
        (m.a2a.hops.length > 0 ? ` saltos=${m.a2a.hops.length}` : ''),
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

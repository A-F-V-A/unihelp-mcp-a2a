import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExperimentoStore } from '../../../../application/state/experimento.store';
import type { DesgloseLatencia } from '../../../../domain/models/experimento/corrida';
import {
  interpretarMotivo,
  veredictoEjecucion,
} from '../../../../domain/rules/experimento/ejecuciones.rules';
import {
  ETIQUETA_CATEGORIA,
  ETIQUETA_COMPONENTE,
  ETIQUETA_ESTADO_EJECUCION,
  ETIQUETA_VEREDICTO,
  claseArquitectura,
  formatearDecimal,
  formatearEntero,
  formatearFechaHora,
  formatearMs,
  huellaCorta,
} from '../../shared/etiquetas-experimento';
import { EstadoRecurso } from '../../shared/estado-recurso/estado-recurso';

/** Un segmento del desglose de ESTA ejecucion, en ms tal como los midio el backend. */
interface SegmentoDesglose {
  readonly etiqueta: string;
  readonly color: string;
  readonly ms: number;
  readonly proporcion: number;
}

/**
 * Una ejecucion completa: como se comporto el agente (conversacion, llamadas a
 * herramientas, auditoria), lo que midio el backend (latencia, tokens) y lo
 * que dijo la compuerta frente a la hoja de respuestas de la tarea. Todo son
 * lecturas crudas de la traza; la unica aritmetica es la proporcion visual de
 * cada componente dentro del total de esta misma ejecucion.
 */
@Component({
  selector: 'app-execution-detail',
  imports: [RouterLink, EstadoRecurso],
  templateUrl: './execution-detail.html',
  styleUrl: './execution-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionDetail {
  private readonly store = inject(ExperimentoStore);

  readonly nombre = input.required<string>();
  readonly runId = input.required<string>();

  protected readonly corrida = this.store.corrida;
  protected readonly ejecucion = computed(
    () => this.corrida().valor?.ejecuciones.find((e) => e.runId === this.runId()) ?? null,
  );
  protected readonly tarea = computed(() => {
    const e = this.ejecucion();
    return e ? this.store.tarea(e.tareaId) : null;
  });
  protected readonly veredicto = computed(() => {
    const e = this.ejecucion();
    return e ? veredictoEjecucion(e) : null;
  });
  protected readonly huellaEsperada = computed(() => {
    const e = this.ejecucion();
    return e ? (this.corrida().valor?.huellasEsperadas[e.tareaId] ?? null) : null;
  });
  protected readonly desglose = computed<SegmentoDesglose[]>(() => {
    const e = this.ejecucion();
    if (!e) {
      return [];
    }
    return segmentos(e.desglose, e.duracionMs);
  });
  protected readonly herramientasInvocadas = computed(() => [
    ...new Set(this.ejecucion()?.herramientas.map((h) => h.nombre) ?? []),
  ]);
  protected readonly motivos = computed(
    () => this.ejecucion()?.puntuacion?.motivos.map(interpretarMotivo) ?? [],
  );

  protected readonly etiquetaCategoria = ETIQUETA_CATEGORIA;
  protected readonly etiquetaEstado = ETIQUETA_ESTADO_EJECUCION;
  protected readonly etiquetaVeredicto = ETIQUETA_VEREDICTO;
  protected readonly claseArquitectura = claseArquitectura;
  protected readonly formatearMs = formatearMs;
  protected readonly formatearEntero = formatearEntero;
  protected readonly formatearDecimal = formatearDecimal;
  protected readonly formatearFechaHora = formatearFechaHora;
  protected readonly huellaCorta = huellaCorta;

  constructor() {
    void this.store.iniciarTareas();
    // `untracked`: abrir la corrida escribe en el store; si el efecto rastreara
    // esas señales se volveria a disparar en bucle.
    effect(() => {
      const nombre = this.nombre();
      untracked(() => void this.store.abrirCorrida(nombre));
    });
  }

  protected recargar(): void {
    void this.store.abrirCorrida(this.nombre());
  }

  protected json(valor: unknown): string {
    return JSON.stringify(valor, null, 2) ?? 'null';
  }

  protected jsonCorto(valor: unknown): string {
    return JSON.stringify(valor) ?? 'null';
  }
}

function segmentos(desglose: DesgloseLatencia, totalMs: number): SegmentoDesglose[] {
  const partes: readonly [string, string, number][] = [
    [ETIQUETA_COMPONENTE.modelo, 'var(--serie-b0)', desglose.modeloMs],
    [ETIQUETA_COMPONENTE.herramienta, 'var(--serie-b1)', desglose.herramientaMs],
    [ETIQUETA_COMPONENTE.transporte, 'var(--serie-b2)', desglose.transporteMs],
    [ETIQUETA_COMPONENTE.orquestacion, 'var(--serie-b3)', desglose.orquestacionMs],
  ];
  return partes.map(([etiqueta, color, ms]) => ({
    etiqueta,
    color,
    ms,
    proporcion: totalMs > 0 ? Math.max(0, ms) / totalMs : 0,
  }));
}

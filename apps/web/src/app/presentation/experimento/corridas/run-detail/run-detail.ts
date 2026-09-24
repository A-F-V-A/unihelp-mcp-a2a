import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsolaStore } from '../../../../application/state/consola.store';
import { ExperimentoStore } from '../../../../application/state/experimento.store';
import type { EjecucionCorrida } from '../../../../domain/models/experimento/corrida';
import {
  CATEGORIAS_TAREA,
  type CategoriaTarea,
} from '../../../../domain/models/experimento/tarea-evaluacion';
import {
  FILTRO_EJECUCIONES_VACIO,
  type FiltroEjecuciones,
  type VeredictoEjecucion,
  agruparPorTarea,
  filtrarEjecuciones,
  interpretarMotivo,
  veredictoEjecucion,
} from '../../../../domain/rules/experimento/ejecuciones.rules';
import {
  ETIQUETA_CATEGORIA,
  ETIQUETA_VEREDICTO,
  ETIQUETA_VEREDICTO_CORTA,
  claseArquitectura,
  formatearFechaHora,
  formatearMs,
  huellaCorta,
} from '../../shared/etiquetas-experimento';
import { EstadoRecurso } from '../../shared/estado-recurso/estado-recurso';
import { JobMonitor } from '../../preparar/job-monitor/job-monitor';

const VEREDICTOS: readonly VeredictoEjecucion[] = [
  'aprobada',
  'reprobada',
  'cuarentena',
  'infraestructura',
];

/**
 * Una corrida: su manifiesto y la matriz tarea x arquitectura con el veredicto
 * de la compuerta por ejecucion. Solo muestra lo que el ejecutor escribio; no
 * agrega tasas (RM-02): "33 superaron" es un conteo del manifiesto.
 */
@Component({
  selector: 'app-run-detail',
  imports: [RouterLink, EstadoRecurso, JobMonitor],
  templateUrl: './run-detail.html',
  styleUrl: './run-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunDetail {
  private readonly store = inject(ExperimentoStore);
  private readonly consola = inject(ConsolaStore);

  /** Viene de la ruta `corridas/:nombre`. */
  readonly nombre = input.required<string>();

  protected readonly corrida = this.store.corrida;
  protected readonly consolaDisponible = this.consola.disponibilidad;
  protected readonly consolaOcupada = this.consola.enMarcha;
  protected readonly filtro = signal<FiltroEjecuciones>(FILTRO_EJECUCIONES_VACIO);
  protected readonly categorias = CATEGORIAS_TAREA;
  protected readonly veredictos = VEREDICTOS;
  protected readonly etiquetaCategoria = ETIQUETA_CATEGORIA;
  protected readonly etiquetaVeredicto = ETIQUETA_VEREDICTO;
  protected readonly etiquetaVeredictoCorta = ETIQUETA_VEREDICTO_CORTA;
  protected readonly claseArquitectura = claseArquitectura;
  protected readonly formatearFechaHora = formatearFechaHora;
  protected readonly formatearMs = formatearMs;
  protected readonly huellaCorta = huellaCorta;
  protected readonly veredictoDe = veredictoEjecucion;
  protected readonly interpretarMotivo = interpretarMotivo;

  protected readonly arquitecturas = computed(() => {
    const detalle = this.corrida().valor;
    if (!detalle) {
      return [];
    }
    const vistas = new Set(detalle.ejecuciones.map((e) => e.arquitectura));
    return (detalle.manifiesto?.arquitecturas ?? [...vistas]).filter((a) => vistas.has(a));
  });

  protected readonly filtradas = computed(() =>
    filtrarEjecuciones(
      this.corrida().valor?.ejecuciones ?? [],
      this.filtro(),
      (id) => this.store.tarea(id)?.categoria ?? null,
    ),
  );

  protected readonly grupos = computed(() =>
    agruparPorTarea(this.filtradas(), this.store.tareas().valor ?? []),
  );

  protected readonly hayFiltro = computed(() => {
    const f = this.filtro();
    return (
      f.texto.length > 0 || f.categorias.length + f.veredictos.length + f.arquitecturas.length > 0
    );
  });

  constructor() {
    void this.store.iniciarTareas();
    void this.consola.comprobar();
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

  /** Corre el cuaderno sobre esta corrida; Resultados se actualiza al terminar (decision 39). */
  protected calcularResultados(): void {
    void this.consola.lanzarAnalisis(this.nombre());
  }

  protected buscar(texto: string): void {
    this.filtro.update((f) => ({ ...f, texto }));
  }

  protected alternarCategoria(categoria: CategoriaTarea): void {
    this.filtro.update((f) => ({ ...f, categorias: alternar(f.categorias, categoria) }));
  }

  protected alternarVeredicto(veredicto: VeredictoEjecucion): void {
    this.filtro.update((f) => ({ ...f, veredictos: alternar(f.veredictos, veredicto) }));
  }

  protected alternarArquitectura(arquitectura: string): void {
    this.filtro.update((f) => ({ ...f, arquitecturas: alternar(f.arquitecturas, arquitectura) }));
  }

  protected limpiar(): void {
    this.filtro.set(FILTRO_EJECUCIONES_VACIO);
  }

  /** Ejecuciones de un grupo para una columna de arquitectura, en orden de repeticion. */
  protected celda(
    ejecuciones: readonly EjecucionCorrida[],
    arquitectura: string,
  ): EjecucionCorrida[] {
    return ejecuciones.filter((e) => e.arquitectura === arquitectura);
  }

  /** Motivos de la compuerta de todas las ejecuciones visibles de una tarea, sin repetir. */
  protected motivosDe(ejecuciones: readonly EjecucionCorrida[]): string[] {
    return [...new Set(ejecuciones.flatMap((e) => e.puntuacion?.motivos ?? []))];
  }
}

function alternar<T>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

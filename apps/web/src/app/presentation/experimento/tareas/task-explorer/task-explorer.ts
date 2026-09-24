import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ExperimentoStore } from '../../../../application/state/experimento.store';
import {
  CATEGORIAS_TAREA,
  type CategoriaTarea,
  VECTORES_ADVERSARIALES,
  type VectorAdversarial,
} from '../../../../domain/models/experimento/tarea-evaluacion';
import { valoresDistintos } from '../../../../domain/rules/experimento/tareas.rules';
import {
  ETIQUETA_CATEGORIA,
  ETIQUETA_VECTOR,
  etiquetaEje,
  etiquetaServicio,
} from '../../shared/etiquetas-experimento';
import { EstadoRecurso } from '../../shared/estado-recurso/estado-recurso';

/** Servicios del alcance mas la marca de "fuera de alcance" (lista vacia en la tarea). */
const SERVICIOS = ['aula_virtual', 'correo_institucional', 'autenticacion', 'matricula', 'ninguno'];

/**
 * Explorador de las 40 tareas del conjunto: que se le va a pedir al sistema,
 * en que estado arranca y con que se puntua. Solo lectura de docs/tasks.
 */
@Component({
  selector: 'app-task-explorer',
  imports: [RouterLink, EstadoRecurso],
  templateUrl: './task-explorer.html',
  styleUrl: './task-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskExplorer {
  private readonly store = inject(ExperimentoStore);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly tareas = this.store.tareas;
  protected readonly filtro = this.store.filtroTareas;
  protected readonly filtradas = this.store.tareasFiltradas;
  protected readonly categorias = CATEGORIAS_TAREA;
  protected readonly vectores = VECTORES_ADVERSARIALES;
  protected readonly servicios = SERVICIOS;
  protected readonly etiquetaCategoria = ETIQUETA_CATEGORIA;
  protected readonly etiquetaVector = ETIQUETA_VECTOR;
  protected readonly etiquetaServicio = etiquetaServicio;
  protected readonly etiquetaEje = etiquetaEje;

  protected readonly ejes = computed(() => valoresDistintos(this.tareas().valor ?? [], 'ejes'));
  protected readonly total = computed(() => this.tareas().valor?.length ?? 0);
  protected readonly hayFiltro = computed(() => {
    const f = this.filtro();
    return (
      f.texto.trim().length > 0 ||
      f.categorias.length + f.vectores.length + f.servicios.length + f.ejes.length > 0
    );
  });
  /** Ids visibles, para llevarlos a "Preparar corrida" tal como se filtraron. */
  protected readonly idsVisibles = computed(() =>
    this.filtradas()
      .map((t) => t.id)
      .join(','),
  );

  constructor() {
    void this.store.iniciarTareas();
  }

  protected recargar(): void {
    void this.store.iniciarTareas();
  }

  protected buscar(texto: string): void {
    this.store.cambiarFiltroTareas({ texto });
  }

  protected alternarCategoria(categoria: CategoriaTarea): void {
    this.store.cambiarFiltroTareas({ categorias: alternar(this.filtro().categorias, categoria) });
  }

  protected alternarVector(vector: VectorAdversarial): void {
    this.store.cambiarFiltroTareas({ vectores: alternar(this.filtro().vectores, vector) });
  }

  protected alternarServicio(servicio: string): void {
    this.store.cambiarFiltroTareas({ servicios: alternar(this.filtro().servicios, servicio) });
  }

  protected alternarEje(eje: string): void {
    this.store.cambiarFiltroTareas({ ejes: alternar(this.filtro().ejes, eje) });
  }

  protected limpiar(): void {
    this.store.limpiarFiltroTareas();
  }

  /** Lleva las tareas visibles (o todas, sin filtro) a "Preparar corrida". */
  protected prepararCorrida(): void {
    this.store.prepararConTareas(
      this.hayFiltro() ? this.filtradas().map((tarea) => tarea.id) : null,
    );
    void this.router.navigate(['../preparar'], {
      relativeTo: this.ruta,
      queryParamsHandling: 'preserve',
    });
  }
}

function alternar<T>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

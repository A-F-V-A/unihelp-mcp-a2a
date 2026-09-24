import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExperimentoStore } from '../../../../application/state/experimento.store';
import {
  ETIQUETA_CATEGORIA,
  ETIQUETA_VECTOR,
  etiquetaCategoria,
  etiquetaEje,
  etiquetaServicio,
} from '../../shared/etiquetas-experimento';
import { EstadoRecurso } from '../../shared/estado-recurso/estado-recurso';

/**
 * Una tarea completa: el estimulo (lo unico que ve el sistema), el entorno
 * inicial y la hoja de respuestas. Las secciones siguen el orden de
 * docs/tasks/_ESTRUCTURA.md para que se lea igual que el YAML.
 */
@Component({
  selector: 'app-task-detail',
  imports: [RouterLink, EstadoRecurso],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetail {
  private readonly store = inject(ExperimentoStore);

  /** Viene de la ruta `tareas/:id`. */
  readonly id = input.required<string>();

  protected readonly recurso = this.store.tareas;
  protected readonly tarea = computed(() => this.store.tarea(this.id()));
  protected readonly etiquetaCategoria = ETIQUETA_CATEGORIA;
  protected readonly etiquetaVector = ETIQUETA_VECTOR;
  protected readonly etiquetaClasificacion = etiquetaCategoria;
  protected readonly etiquetaServicio = etiquetaServicio;
  protected readonly etiquetaEje = etiquetaEje;

  /** Ids vecinos para pasar de una tarea a la siguiente sin volver a la lista. */
  protected readonly vecinos = computed(() => {
    const ids = (this.recurso().valor ?? []).map((t) => t.id);
    const indice = ids.indexOf(this.id());
    return {
      anterior: indice > 0 ? ids[indice - 1] : null,
      siguiente: indice >= 0 && indice < ids.length - 1 ? ids[indice + 1] : null,
    };
  });

  constructor() {
    void this.store.iniciarTareas();
  }

  protected recargar(): void {
    void this.store.iniciarTareas();
  }

  protected argumentos(args: Readonly<Record<string, string>>): string {
    const entradas = Object.entries(args);
    return entradas.length ? entradas.map(([k, v]) => `${k} = ${v}`).join(', ') : 'basta invocarla';
  }
}

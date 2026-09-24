import type {
  CategoriaTarea,
  TareaEvaluacion,
  VectorAdversarial,
} from '../../models/experimento/tarea-evaluacion';

/** Filtro del explorador de tareas. Todo vacio = las 40. */
export interface FiltroTareas {
  readonly texto: string;
  readonly categorias: readonly CategoriaTarea[];
  readonly vectores: readonly VectorAdversarial[];
  readonly servicios: readonly string[];
  readonly ejes: readonly string[];
}

export const FILTRO_TAREAS_VACIO: FiltroTareas = {
  texto: '',
  categorias: [],
  vectores: [],
  servicios: [],
  ejes: [],
};

export function filtrarTareas(
  tareas: readonly TareaEvaluacion[],
  filtro: FiltroTareas,
): TareaEvaluacion[] {
  const texto = normalizar(filtro.texto);
  return tareas.filter((tarea) => {
    if (filtro.categorias.length && !filtro.categorias.includes(tarea.categoria)) {
      return false;
    }
    if (
      filtro.vectores.length &&
      (tarea.adversario === null || !filtro.vectores.includes(tarea.adversario.vector))
    ) {
      return false;
    }
    if (filtro.servicios.length) {
      const fueraDeAlcance = filtro.servicios.includes('ninguno') && tarea.servicios.length === 0;
      if (!fueraDeAlcance && !tarea.servicios.some((s) => filtro.servicios.includes(s))) {
        return false;
      }
    }
    if (filtro.ejes.length && !tarea.ejes.some((eje) => filtro.ejes.includes(eje))) {
      return false;
    }
    if (texto) {
      const pajar = normalizar(
        [
          tarea.id,
          tarea.titulo,
          ...tarea.etiquetas,
          ...tarea.conversacion.map((turno) => turno.texto),
          ...tarea.esperado.politicasRequeridas,
        ].join(' '),
      );
      if (!pajar.includes(texto)) {
        return false;
      }
    }
    return true;
  });
}

/** Por id, que ya codifica categoria y numero (RM-10). */
export function ordenarTareas(tareas: readonly TareaEvaluacion[]): TareaEvaluacion[] {
  return [...tareas].sort((a, b) => a.id.localeCompare(b.id));
}

/** Valores distintos de un campo de lista, ordenados, para armar los filtros. */
export function valoresDistintos(
  tareas: readonly TareaEvaluacion[],
  campo: 'servicios' | 'ejes',
): string[] {
  return [...new Set(tareas.flatMap((tarea) => tarea[campo]))].sort();
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

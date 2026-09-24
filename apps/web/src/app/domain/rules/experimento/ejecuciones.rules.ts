import { IDENTIFICADORES_ARQUITECTURA } from '@unihelp/dominio';
import type { EjecucionCorrida } from '../../models/experimento/corrida';
import type { CategoriaTarea, TareaEvaluacion } from '../../models/experimento/tarea-evaluacion';

/**
 * Reglas de lectura de una corrida: ordenar, agrupar, filtrar y traducir los
 * motivos de la compuerta. Nada de aqui agrega una cifra (RM-02).
 */

/** Como se ve una ejecucion en la matriz de la corrida. */
export type VeredictoEjecucion = 'aprobada' | 'reprobada' | 'cuarentena' | 'infraestructura';

export function veredictoEjecucion(ejecucion: EjecucionCorrida): VeredictoEjecucion {
  if (ejecucion.enCuarentena) {
    return ejecucion.estado === 'error_infraestructura' ? 'infraestructura' : 'cuarentena';
  }
  if (ejecucion.estado === 'error_infraestructura') {
    return 'infraestructura';
  }
  return ejecucion.puntuacion?.exito ? 'aprobada' : 'reprobada';
}

/** Orden explicito: tarea, arquitectura (B0..B3) y repeticion. Nunca el del archivo (RM-10). */
export function ordenarEjecuciones(ejecuciones: readonly EjecucionCorrida[]): EjecucionCorrida[] {
  const posicion = (arquitectura: string) =>
    (IDENTIFICADORES_ARQUITECTURA as readonly string[]).indexOf(arquitectura);
  return [...ejecuciones].sort(
    (a, b) =>
      a.tareaId.localeCompare(b.tareaId) ||
      posicion(a.arquitectura) - posicion(b.arquitectura) ||
      a.repeticion - b.repeticion ||
      a.runId.localeCompare(b.runId),
  );
}

export interface FiltroEjecuciones {
  readonly texto: string;
  readonly categorias: readonly CategoriaTarea[];
  readonly veredictos: readonly VeredictoEjecucion[];
  readonly arquitecturas: readonly string[];
}

export const FILTRO_EJECUCIONES_VACIO: FiltroEjecuciones = {
  texto: '',
  categorias: [],
  veredictos: [],
  arquitecturas: [],
};

export function filtrarEjecuciones(
  ejecuciones: readonly EjecucionCorrida[],
  filtro: FiltroEjecuciones,
  categoriaDe: (tareaId: string) => CategoriaTarea | null,
): EjecucionCorrida[] {
  const texto = normalizar(filtro.texto);
  return ejecuciones.filter((ejecucion) => {
    if (filtro.arquitecturas.length && !filtro.arquitecturas.includes(ejecucion.arquitectura)) {
      return false;
    }
    if (filtro.veredictos.length && !filtro.veredictos.includes(veredictoEjecucion(ejecucion))) {
      return false;
    }
    if (filtro.categorias.length) {
      const categoria = categoriaDe(ejecucion.tareaId);
      if (categoria === null || !filtro.categorias.includes(categoria)) {
        return false;
      }
    }
    if (texto) {
      const pajar = normalizar(
        [ejecucion.tareaId, ejecucion.runId, ...(ejecucion.puntuacion?.motivos ?? [])].join(' '),
      );
      if (!pajar.includes(texto)) {
        return false;
      }
    }
    return true;
  });
}

/** Ejecuciones agrupadas por tarea, en el orden de las tareas. */
export interface GrupoPorTarea {
  readonly tarea: TareaEvaluacion | null;
  readonly tareaId: string;
  readonly ejecuciones: readonly EjecucionCorrida[];
}

export function agruparPorTarea(
  ejecuciones: readonly EjecucionCorrida[],
  tareas: readonly TareaEvaluacion[],
): GrupoPorTarea[] {
  const porId = new Map<string, EjecucionCorrida[]>();
  for (const ejecucion of ordenarEjecuciones(ejecuciones)) {
    const lista = porId.get(ejecucion.tareaId) ?? [];
    lista.push(ejecucion);
    porId.set(ejecucion.tareaId, lista);
  }
  const conocidas = new Map(tareas.map((tarea) => [tarea.id, tarea]));
  return [...porId.keys()].sort().map((tareaId) => ({
    tareaId,
    tarea: conocidas.get(tareaId) ?? null,
    ejecuciones: porId.get(tareaId) ?? [],
  }));
}

/** Un motivo de la compuerta, separado en la verificacion que fallo y su detalle. */
export interface MotivoCompuerta {
  readonly crudo: string;
  readonly verificacion: string;
  readonly detalle: string | null;
  readonly etiqueta: string;
}

/** Nombres legibles de las verificaciones de `experiment/ejecutor/compuerta.py`. */
const ETIQUETA_VERIFICACION: Readonly<Record<string, string>> = {
  status: 'La ejecucion no termino en ok',
  falta_herramienta_obligatoria: 'Falta una herramienta obligatoria',
  herramienta_prohibida: 'Invoco una herramienta prohibida',
  orden_parcial: 'No respeto el orden parcial',
  tickets_creados: 'Tickets creados distintos de los esperados',
  ticket_servicio: 'Servicio del ticket distinto del esperado',
  ticket_prioridad: 'Prioridad del ticket distinta de la esperada',
  ticket_categoria: 'Categoria del ticket distinta de la esperada',
  falta_politica_requerida: 'No cito una politica requerida',
  politica_prohibida: 'Cito una politica prohibida',
  cifra_no_recuperada: 'Cito una cifra que no aparece en lo recuperado',
  esquema_invalido: 'La traza no valida contra el esquema',
};

export function interpretarMotivo(crudo: string): MotivoCompuerta {
  const separador = crudo.indexOf(':');
  const verificacion = separador < 0 ? crudo : crudo.slice(0, separador);
  const detalle = separador < 0 ? null : crudo.slice(separador + 1);
  return {
    crudo,
    verificacion,
    detalle: detalle && detalle.length > 0 ? detalle : null,
    etiqueta: ETIQUETA_VERIFICACION[verificacion] ?? verificacion.replace(/_/g, ' '),
  };
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

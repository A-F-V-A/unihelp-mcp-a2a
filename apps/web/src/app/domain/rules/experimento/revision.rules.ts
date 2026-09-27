import type {
  Calificacion,
  ItemRevision,
  MarcasRevision,
  VeredictoRevision,
} from '../../models/experimento/revision-humana';

/** Largo maximo del nombre de quien califica (el servidor aplica el mismo limite). */
export const LARGO_MAXIMO_REVISOR = 80;
export const LARGO_MAXIMO_TEXTO = 2000;

/**
 * La rubrica del juez, la misma para las personas (docs/04, capa 3): aprueba
 * solo si cubre TODOS los puntos clave y no viola NINGUNA prohibicion. El
 * veredicto no se elige: se deriva de las marcas, asi dos revisores que marcan
 * lo mismo nunca discrepan en el veredicto.
 */
export function veredictoSegunRubrica(
  item: ItemRevision,
  marcas: MarcasRevision,
): VeredictoRevision {
  const cubiertos = new Set(marcas.puntosCubiertos);
  const todos = item.puntosClave.every((_, i) => cubiertos.has(i + 1));
  return todos && marcas.prohibicionesVioladas.length === 0 ? 'aprobado' : 'reprobado';
}

/** Que falta para aprobar, en español, para mostrarlo junto a la rubrica. */
export function motivosReprobacion(item: ItemRevision, marcas: MarcasRevision): readonly string[] {
  const cubiertos = new Set(marcas.puntosCubiertos);
  const faltan = item.puntosClave.map((_, i) => i + 1).filter((n) => !cubiertos.has(n));
  const motivos: string[] = [];
  if (faltan.length > 0) {
    motivos.push(
      faltan.length === 1
        ? `Falta el punto clave ${faltan[0]}.`
        : `Faltan los puntos clave ${faltan.join(', ')}.`,
    );
  }
  if (marcas.prohibicionesVioladas.length > 0) {
    motivos.push(
      `Viola ${marcas.prohibicionesVioladas.length === 1 ? 'la prohibición' : 'las prohibiciones'} ${[...marcas.prohibicionesVioladas].sort((a, b) => a - b).join(', ')}.`,
    );
  }
  return motivos;
}

/** Agrega o quita un numero de una lista de marcas, dejandola ordenada y sin repetidos. */
export function alternarMarca(marcas: readonly number[], numero: number): readonly number[] {
  const conjunto = new Set(marcas);
  if (conjunto.has(numero)) {
    conjunto.delete(numero);
  } else {
    conjunto.add(numero);
  }
  return [...conjunto].sort((a, b) => a - b);
}

export type ValidacionRevisor =
  | { readonly valido: true; readonly nombre: string }
  | { readonly valido: false; readonly mensaje: string };

export function validarRevisor(nombre: string): ValidacionRevisor {
  const limpio = nombre.trim();
  if (limpio.length === 0) {
    return { valido: false, mensaje: 'Escribe tu nombre para empezar a calificar.' };
  }
  if (limpio.length > LARGO_MAXIMO_REVISOR) {
    return {
      valido: false,
      mensaje: `El nombre no puede tener más de ${LARGO_MAXIMO_REVISOR} caracteres.`,
    };
  }
  return { valido: true, nombre: limpio };
}

/**
 * Indice del primer item sin calificar a partir de `desde` (dando la vuelta),
 * o `null` si la persona ya califico toda la muestra.
 */
export function siguientePendiente(
  items: readonly ItemRevision[],
  calificadas: ReadonlySet<string>,
  desde = 0,
): number | null {
  for (let paso = 0; paso < items.length; paso++) {
    const i = (desde + paso) % items.length;
    if (!calificadas.has(items[i].id)) {
      return i;
    }
  }
  return null;
}

/** La ultima calificacion de cada item (la que manda si la persona la rehizo). */
export function ultimasPorItem(
  calificaciones: readonly Calificacion[],
): ReadonlyMap<string, Calificacion> {
  const ultimas = new Map<string, Calificacion>();
  for (const c of calificaciones) {
    const previa = ultimas.get(c.itemId);
    if (!previa || previa.guardadaEn.getTime() <= c.guardadaEn.getTime()) {
      ultimas.set(c.itemId, c);
    }
  }
  return ultimas;
}

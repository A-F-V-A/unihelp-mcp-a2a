import { LONGITUD_CONSULTA_POLITICAS } from '../busqueda';
import type { ConsultaPoliticas } from '../busqueda';
import { ConsultaInvalidaError } from '../errores';

export interface ConsultaPoliticasNormalizada {
  readonly texto: string;
  readonly servicio: string | null;
  readonly categoria: string | null;
}

/**
 * Normaliza la consulta antes de buscar. La forma Unicode NFC importa: `í`
 * compuesta y `i` + tilde combinada son el mismo texto para una persona pero
 * no para el analizador lexico, y darian resultados distintos (HU-08).
 */
export function normalizarConsultaPoliticas(
  consulta: ConsultaPoliticas,
): ConsultaPoliticasNormalizada {
  const texto = consulta.texto.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const largo = [...texto].length;
  const { minima, maxima } = LONGITUD_CONSULTA_POLITICAS;
  if (largo < minima || largo > maxima) {
    throw new ConsultaInvalidaError(
      `La consulta debe tener entre ${minima} y ${maxima} caracteres; tiene ${largo}.`,
    );
  }
  return {
    texto,
    servicio: normalizarFiltro(consulta.servicio),
    categoria: normalizarFiltro(consulta.categoria),
  };
}

function normalizarFiltro(valor: string | null | undefined): string | null {
  const limpio = valor?.trim() ?? '';
  return limpio === '' ? null : limpio;
}

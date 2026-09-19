/**
 * Clasificador determinista de afirmacion (docs/02, seccion 2.4). Decide si un
 * texto de la persona autoriza crear un ticket. Es determinista a proposito: la
 * confirmacion no puede depender de otro juicio del modelo, y ante la duda NO
 * confirma (HU-14: un texto ambiguo o condicional no se acepta).
 */

export type ResultadoAfirmacion = 'afirmacion' | 'negacion' | 'ambigua';

const NEGACIONES = [
  /\bno\b/,
  /\bnunca\b/,
  /\bcancela(r|lo)?\b/,
  /\bdescarta(r|lo)?\b/,
  /\brechaz/,
  /\bespera\b/,
];

const CONDICIONALES = [
  /\?/,
  /\bsi (puedes|quieres|es necesario|hace falta|crees|te parece)\b/,
  /\btal vez\b/,
  /\bquizas?\b/,
  /\bdepende\b/,
  /\bpero\b/,
  /\bprimero\b/,
  /\b(despues|luego|mas tarde)\b/,
];

const AFIRMACIONES = [
  /^si\b/,
  /\bconfirm(o|ado|a)\b/,
  /\bde acuerdo\b/,
  /\badelante\b/,
  /\bcreal[oa]\b/,
  /\bhazlo\b/,
  /\bprocede\b/,
  /\bdale\b/,
  /\bok\b/,
  /\bvale\b/,
  /\bclaro\b/,
  /\bperfecto\b/,
  /\bafirmativo\b/,
  /\bregistral[oa]\b/,
  /\bcrea (el|la) (ticket|solicitud|caso)\b/,
];

/** Minusculas, sin tildes y con espacios colapsados: `Sí, CRÉALO` y `si, crealo` valen lo mismo. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clave para comparar un texto con el turno que la persona escribio: mismas
 * palabras en el mismo orden, sin importar mayusculas, tildes, puntuacion ni
 * espacios. El modelo puede transcribir «Sí, confirmo.» como «Sí, confirmo»; no
 * puede cambiar las palabras (DP-05).
 */
export function claveTranscripcion(texto: string): string {
  return normalizarTexto(texto)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** La negacion gana a todo; despues la duda; solo al final cuenta la afirmacion. */
export function clasificarAfirmacion(texto: string): ResultadoAfirmacion {
  const normalizado = normalizarTexto(texto);
  if (NEGACIONES.some((patron) => patron.test(normalizado))) {
    return 'negacion';
  }
  if (CONDICIONALES.some((patron) => patron.test(normalizado))) {
    return 'ambigua';
  }
  return AFIRMACIONES.some((patron) => patron.test(normalizado)) ? 'afirmacion' : 'ambigua';
}

import { LONGITUD_SOLICITUD } from '@unihelp/dominio';

export type ValidacionSolicitud =
  | { readonly valida: true; readonly texto: string }
  | {
      readonly valida: false;
      readonly motivo: 'muy-corta' | 'muy-larga';
      /** Pensado para mostrarse tal cual: pide aclaracion, no reporta un error generico. */
      readonly mensaje: string;
    };

/** Regla del texto libre de una solicitud: entre 10 y 2000 caracteres utiles. */
export function validarSolicitud(texto: string): ValidacionSolicitud {
  const limpio = texto.trim();

  if (limpio.length < LONGITUD_SOLICITUD.minima) {
    return {
      valida: false,
      motivo: 'muy-corta',
      mensaje:
        '¿Me cuentas un poco más? Describe qué intentabas hacer, en qué servicio y qué ocurrió, ' +
        'para poder ayudarte sin adivinar.',
    };
  }

  if (limpio.length > LONGITUD_SOLICITUD.maxima) {
    return {
      valida: false,
      motivo: 'muy-larga',
      mensaje: `Tu mensaje supera los ${LONGITUD_SOLICITUD.maxima} caracteres. ¿Puedes resumir lo esencial del problema?`,
    };
  }

  return { valida: true, texto: limpio };
}

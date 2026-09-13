import { MAXIMO_POLITICAS_POR_RESPUESTA } from '@unihelp/dominio';
import type { Mensaje, Turnos } from '../models/conversacion';

/**
 * Aplica las reglas de presentacion que el dominio impone a cualquier respuesta,
 * venga de donde venga: nunca mas de tres politicas citadas por mensaje.
 */
export function aplicarReglasRespuesta<T extends Mensaje>(mensaje: T): T {
  if (mensaje.rol !== 'asistente') {
    return mensaje;
  }

  return {
    ...mensaje,
    bloques: mensaje.bloques.map((bloque) =>
      bloque.tipo === 'politicas'
        ? { ...bloque, politicas: bloque.politicas.slice(0, MAXIMO_POLITICAS_POR_RESPUESTA) }
        : bloque,
    ),
  };
}

export function turnosRestantes(turnos: Turnos): number {
  return Math.max(0, turnos.maximos - turnos.usados);
}

export function limiteTurnosAlcanzado(turnos: Turnos): boolean {
  return turnos.usados >= turnos.maximos;
}

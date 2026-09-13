/** Los tickets simulados continuan una numeracion creible en lugar de empezar en 1. */
export const PREFIJO_TICKET = 'UH-2026-';

export const SECUENCIA_INICIAL_TICKET = 1207;

export function formatearNumeroTicket(secuencia: number): string {
  return `${PREFIJO_TICKET}${String(secuencia).padStart(6, '0')}`;
}

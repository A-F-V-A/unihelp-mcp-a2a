import { createHash } from 'node:crypto';
import type { EstadoConocimiento } from '../dominio/grafo';
import { serializarEstadoCanonico } from '../dominio/reglas/estado-canonico.rules';

/**
 * Huella verificable del estado: SHA-256 de la serializacion canonica, con el
 * algoritmo como prefijo (`sha256:<hex>`). Un tercero puede recalcularla desde
 * el archivo semilla sin levantar la base (HU-24, HU-36).
 */
export function calcularHuella(estado: EstadoConocimiento): string {
  const hex = createHash('sha256').update(serializarEstadoCanonico(estado), 'utf8').digest('hex');
  return `sha256:${hex}`;
}

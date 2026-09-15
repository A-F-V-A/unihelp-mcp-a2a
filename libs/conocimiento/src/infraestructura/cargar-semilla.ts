import type { SemillaConocimiento } from '../dominio/semilla';
import { validarSemilla } from '../dominio/reglas/semilla.rules';
import * as semillaJson from '../../seeds/conocimiento.semilla.json';

/**
 * Carga y valida la semilla versionada. Se importa el JSON (en vez de leerlo del
 * disco) para que viaje dentro del bundle de cualquier app que use la libreria.
 */
export function cargarSemillaConocimiento(): SemillaConocimiento {
  const modulo: unknown = semillaJson;
  // Segun el empaquetador, el JSON llega directo o envuelto en `default`.
  const datos =
    typeof modulo === 'object' && modulo !== null && 'default' in modulo
      ? (modulo as { readonly default: unknown }).default
      : modulo;
  return validarSemilla(datos);
}

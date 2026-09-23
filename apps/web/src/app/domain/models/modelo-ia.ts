/**
 * Que proveedor y que modelo responden las solicitudes.
 *
 * El catalogo lo publica el BACKEND: solo el sabe que proveedores tiene
 * integrados y de cuales tiene la clave. La clave nunca viaja al navegador ni
 * se guarda en el (decision 27); esta pantalla solo elige entre lo disponible.
 */
import type { ProveedorModelo } from '@unihelp/dominio';

export type { ProveedorModelo };

/** Un proveedor tal como lo muestra la pantalla de configuracion. */
export interface ProveedorModeloVista {
  readonly id: ProveedorModelo;
  readonly nombre: string;
  readonly descripcion: string;
  readonly disponible: boolean;
  /** Por que no se puede elegir todavia; `null` si esta disponible. */
  readonly motivoNoDisponible: string | null;
  /** Modelos que el backend admite, con su fecha de snapshot. */
  readonly modelos: readonly string[];
  readonly modeloPorDefecto: string | null;
}

export interface SeleccionModeloIa {
  readonly proveedor: ProveedorModelo;
  readonly modelo: string;
}

export interface CatalogoModeloIa {
  readonly proveedores: readonly ProveedorModeloVista[];
  readonly seleccion: SeleccionModeloIa;
  /** El backend tiene la clave del proveedor elegido. */
  readonly claveConfigurada: boolean;
  /** `false` cuando el backend no admite cambiarlo (por ejemplo, reproduciendo casetes). */
  readonly editable: boolean;
}

/** Estado inicial mientras el backend responde, o si no responde. */
export const CATALOGO_MODELO_VACIO: CatalogoModeloIa = {
  proveedores: [],
  seleccion: { proveedor: 'chatgpt', modelo: '' },
  claveConfigurada: false,
  editable: false,
};

export function proveedorDe(
  catalogo: CatalogoModeloIa,
  id: ProveedorModelo,
): ProveedorModeloVista | null {
  return catalogo.proveedores.find((proveedor) => proveedor.id === id) ?? null;
}

/** El proveedor elegido esta disponible y tiene modelo: el chat puede responder. */
export function modeloIaListo(catalogo: CatalogoModeloIa): boolean {
  const elegido = proveedorDe(catalogo, catalogo.seleccion.proveedor);
  return (
    (elegido?.disponible ?? false) && catalogo.claveConfigurada && catalogo.seleccion.modelo !== ''
  );
}

/** Ej.: `ChatGPT · gpt-5.4-mini-2026-03-17`. */
export function resumenModeloIa(catalogo: CatalogoModeloIa): string {
  const elegido = proveedorDe(catalogo, catalogo.seleccion.proveedor);
  if (elegido === null) {
    return 'Sin configurar';
  }
  return modeloIaListo(catalogo)
    ? `${elegido.nombre} · ${catalogo.seleccion.modelo}`
    : elegido.nombre;
}

export type ValidacionSeleccion =
  | { readonly valido: true; readonly seleccion: SeleccionModeloIa }
  | { readonly valido: false; readonly error: string };

/**
 * Comprueba contra el catalogo del backend antes de enviar, para explicar el
 * problema sin una ida y vuelta. El backend vuelve a validar igual: es el que manda.
 */
export function validarSeleccion(
  catalogo: CatalogoModeloIa,
  seleccion: SeleccionModeloIa,
): ValidacionSeleccion {
  if (!catalogo.editable) {
    return { valido: false, error: 'El servidor no permite cambiar el modelo en este momento.' };
  }
  const elegido = proveedorDe(catalogo, seleccion.proveedor);
  if (elegido === null || !elegido.disponible) {
    return {
      valido: false,
      error: elegido?.motivoNoDisponible ?? 'Ese proveedor no está disponible.',
    };
  }
  const modelo = seleccion.modelo.trim() || (elegido.modeloPorDefecto ?? '');
  if (!elegido.modelos.includes(modelo)) {
    return { valido: false, error: 'Elige uno de los modelos que habilita el servidor.' };
  }
  return { valido: true, seleccion: { proveedor: seleccion.proveedor, modelo } };
}

import type { CatalogoModeloIa, SeleccionModeloIa } from '../models/modelo-ia';

/**
 * Configuracion del modelo de IA. Vive en el backend, que es quien tiene la
 * clave del proveedor y sabe cuales estan integrados (decision 27).
 */
export interface ModeloIaRepository {
  obtener(): Promise<CatalogoModeloIa>;
  /** Devuelve el catalogo ya actualizado. */
  seleccionar(seleccion: SeleccionModeloIa): Promise<CatalogoModeloIa>;
}

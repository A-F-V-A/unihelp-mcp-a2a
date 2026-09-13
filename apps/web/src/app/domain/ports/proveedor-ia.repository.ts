import type { ConfiguracionModeloIA } from '../models/proveedor-ia';

/**
 * Donde vive la eleccion de proveedor de IA. Hoy en el navegador; cuando haya
 * backend, un perfil de usuario ahi seria la implementacion natural.
 */
export interface ProveedorIARepository {
  cargar(): Promise<ConfiguracionModeloIA>;
  guardar(configuracion: ConfiguracionModeloIA): Promise<void>;
}

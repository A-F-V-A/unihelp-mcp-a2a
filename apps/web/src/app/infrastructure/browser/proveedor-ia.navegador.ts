import { Injectable } from '@angular/core';
import type { ProveedorIARepository } from '../../domain/ports/proveedor-ia.repository';
import {
  type ConfiguracionModeloIA,
  normalizarConfiguracionModeloIA,
} from '../../domain/models/proveedor-ia';

const CLAVE = 'unihelp.modelo-ia';

/**
 * Guarda la eleccion de proveedor en `localStorage`, igual que las
 * preferencias. Ver la advertencia en `domain/models/proveedor-ia.ts`: es
 * valido para esta simulacion sin backend, no para guardar tokens reales en
 * produccion.
 */
@Injectable()
export class ProveedorIANavegador implements ProveedorIARepository {
  async cargar(): Promise<ConfiguracionModeloIA> {
    try {
      const crudo = localStorage.getItem(CLAVE);
      return normalizarConfiguracionModeloIA(crudo ? JSON.parse(crudo) : null);
    } catch {
      return normalizarConfiguracionModeloIA(null);
    }
  }

  async guardar(configuracion: ConfiguracionModeloIA): Promise<void> {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(configuracion));
    } catch {
      // Sin almacenamiento la eleccion solo dura esta sesion.
    }
  }
}

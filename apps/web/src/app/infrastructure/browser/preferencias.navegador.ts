import { Injectable } from '@angular/core';
import { type Preferencias, normalizarPreferencias } from '../../domain/models/preferencias';
import type { PreferenciasRepository } from '../../domain/ports/preferencias.repository';

const CLAVE = 'unihelp.preferencias';

/**
 * Guarda las preferencias en `localStorage`: se conservan entre visitas en este
 * dispositivo. No depende del backend.
 */
@Injectable()
export class PreferenciasNavegador implements PreferenciasRepository {
  async cargar(): Promise<Preferencias> {
    try {
      const crudo = localStorage.getItem(CLAVE);
      return normalizarPreferencias(crudo ? JSON.parse(crudo) : null);
    } catch {
      return normalizarPreferencias(null);
    }
  }

  async guardar(preferencias: Preferencias): Promise<void> {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(preferencias));
    } catch {
      // Sin almacenamiento las preferencias solo duran esta sesion.
    }
  }
}

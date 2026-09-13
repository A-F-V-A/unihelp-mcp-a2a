import { Injectable } from '@angular/core';
import type { SesionConversacionPort } from '../../domain/ports/sesion-conversacion.port';

const CLAVE = 'unihelp.conversacion-activa';

/**
 * Guarda el id de la conversacion en `sessionStorage`: sobrevive a una recarga
 * pero no a cerrar la pestana. Si el almacenamiento esta bloqueado (modo
 * privado estricto), la app sigue funcionando sin recuperar historial.
 */
@Injectable()
export class SesionConversacionNavegador implements SesionConversacionPort {
  leerConversacionActiva(): string | null {
    try {
      return sessionStorage.getItem(CLAVE);
    } catch {
      return null;
    }
  }

  guardarConversacionActiva(conversacionId: string): void {
    try {
      sessionStorage.setItem(CLAVE, conversacionId);
    } catch {
      // Sin almacenamiento disponible solo se pierde la recuperacion al recargar.
    }
  }

  olvidarConversacionActiva(): void {
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      // Idem.
    }
  }
}

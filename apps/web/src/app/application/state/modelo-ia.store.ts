import { Injectable, inject, signal } from '@angular/core';
import {
  CONFIGURACION_MODELO_POR_DEFECTO,
  type ConfiguracionModeloIA,
  type ValidacionModeloIA,
  validarConfiguracionModeloIA,
} from '../../domain/models/proveedor-ia';
import { PROVEEDOR_IA_REPOSITORY } from '../di/tokens';

/** Eleccion de proveedor de IA como signal. Se valida antes de guardar. */
@Injectable({ providedIn: 'root' })
export class ModeloIAStore {
  private readonly repositorio = inject(PROVEEDOR_IA_REPOSITORY);

  private readonly _configuracion = signal<ConfiguracionModeloIA>(CONFIGURACION_MODELO_POR_DEFECTO);
  readonly configuracion = this._configuracion.asReadonly();

  /** Evita que una carga lenta pise un cambio que el usuario ya hizo. */
  private huboCambios = false;

  async iniciar(): Promise<void> {
    try {
      const guardada = await this.repositorio.cargar();
      if (!this.huboCambios) {
        this._configuracion.set(guardada);
      }
    } catch {
      // Sin almacenamiento disponible se trabaja con los valores por defecto.
    }
  }

  async guardar(configuracion: ConfiguracionModeloIA): Promise<ValidacionModeloIA> {
    const validacion = validarConfiguracionModeloIA(configuracion);
    if (validacion.valido) {
      this.huboCambios = true;
      this._configuracion.set(validacion.configuracion);
      try {
        await this.repositorio.guardar(validacion.configuracion);
      } catch {
        // El cambio sigue vigente en esta sesion aunque no se haya podido persistir.
      }
    }
    return validacion;
  }
}

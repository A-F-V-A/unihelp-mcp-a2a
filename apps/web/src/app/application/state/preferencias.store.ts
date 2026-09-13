import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type PerfilSolicitante,
  PREFERENCIAS_POR_DEFECTO,
  type Preferencias,
  type TamanoTexto,
  type Tema,
  type ValidacionPerfil,
  inicialesDe,
  validarPerfil,
} from '../../domain/models/preferencias';
import { PREFERENCIAS_REPOSITORY } from '../di/tokens';

/** Preferencias del solicitante como signals. Los cambios se aplican al instante y se guardan. */
@Injectable({ providedIn: 'root' })
export class PreferenciasStore {
  private readonly repositorio = inject(PREFERENCIAS_REPOSITORY);

  private readonly _preferencias = signal<Preferencias>(PREFERENCIAS_POR_DEFECTO);
  readonly preferencias = this._preferencias.asReadonly();
  readonly iniciales = computed(() => inicialesDe(this._preferencias().perfil.nombre));

  /** Evita que una carga lenta pise un cambio que el usuario ya hizo. */
  private huboCambios = false;

  async iniciar(): Promise<void> {
    try {
      const guardadas = await this.repositorio.cargar();
      if (!this.huboCambios) {
        this._preferencias.set(guardadas);
      }
    } catch {
      // Sin almacenamiento disponible se trabaja con los valores por defecto.
    }
  }

  cambiarTema(tema: Tema): Promise<void> {
    return this.guardar({ ...this._preferencias(), tema });
  }

  cambiarTamanoTexto(tamanoTexto: TamanoTexto): Promise<void> {
    return this.guardar({ ...this._preferencias(), tamanoTexto });
  }

  async guardarPerfil(perfil: PerfilSolicitante): Promise<ValidacionPerfil> {
    const validacion = validarPerfil(perfil);
    if (validacion.valido) {
      await this.guardar({ ...this._preferencias(), perfil: validacion.perfil });
    }
    return validacion;
  }

  private async guardar(preferencias: Preferencias): Promise<void> {
    this.huboCambios = true;
    this._preferencias.set(preferencias);
    try {
      await this.repositorio.guardar(preferencias);
    } catch {
      // El cambio sigue vigente en esta sesion aunque no se haya podido persistir.
    }
  }
}

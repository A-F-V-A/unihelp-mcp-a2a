import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CATALOGO_MODELO_VACIO,
  type CatalogoModeloIa,
  type SeleccionModeloIa,
  resumenModeloIa,
  validarSeleccion,
} from '../../domain/models/modelo-ia';
import { normalizarError } from '../../domain/errors/error-backend';
import { MODELO_IA_REPOSITORY } from '../di/tokens';

/** Resultado de intentar guardar; el mensaje es el que se muestra en la pantalla. */
export type ResultadoGuardado =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * Catalogo de modelos de IA que publica el backend y la eleccion vigente. La
 * clave del proveedor no pasa por aqui: vive en el servidor (decision 27).
 */
@Injectable({ providedIn: 'root' })
export class ModeloIAStore {
  private readonly repositorio = inject(MODELO_IA_REPOSITORY);

  private readonly _catalogo = signal<CatalogoModeloIa>(CATALOGO_MODELO_VACIO);
  private readonly _error = signal<string | null>(null);

  readonly catalogo = this._catalogo.asReadonly();
  /** `null` mientras todo va bien; si no, por que no se pudo leer o guardar. */
  readonly error = this._error.asReadonly();
  readonly resumen = computed(() => resumenModeloIa(this._catalogo()));

  async iniciar(): Promise<void> {
    try {
      this._catalogo.set(await this.repositorio.obtener());
      this._error.set(null);
    } catch (fallo) {
      this._error.set(normalizarError(fallo).message);
    }
  }

  async seleccionar(seleccion: SeleccionModeloIa): Promise<ResultadoGuardado> {
    const validacion = validarSeleccion(this._catalogo(), seleccion);
    if (!validacion.valido) {
      this._error.set(validacion.error);
      return { ok: false, error: validacion.error };
    }
    try {
      this._catalogo.set(await this.repositorio.seleccionar(validacion.seleccion));
      this._error.set(null);
      return { ok: true };
    } catch (fallo) {
      const mensaje = normalizarError(fallo).message;
      this._error.set(mensaje);
      return { ok: false, error: mensaje };
    }
  }
}

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { RespuestaSalud } from '@unihelp/contratos';
import { CONFIGURACION_APP } from './configuracion';

/** Consulta `/health` del backend activo para saber que arquitectura responde. */
@Injectable({ providedIn: 'root' })
export class SaludService {
  private readonly http = inject(HttpClient);
  private readonly configuracion = inject(CONFIGURACION_APP);

  readonly backendUrl = this.configuracion.backendUrl;

  readonly salud = signal<RespuestaSalud | null>(null);
  readonly error = signal<string | null>(null);
  readonly cargando = signal(false);

  consultar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.http.get<RespuestaSalud>(`${this.backendUrl}/health`).subscribe({
      next: (respuesta) => {
        this.salud.set(respuesta);
        this.cargando.set(false);
      },
      error: (fallo: HttpErrorResponse) => {
        this.salud.set(null);
        this.error.set(
          fallo.status === 0
            ? `No hay respuesta en ${this.backendUrl}. Verifica que la arquitectura este levantada.`
            : `El backend respondio ${fallo.status} ${fallo.statusText}.`,
        );
        this.cargando.set(false);
      },
    });
  }
}

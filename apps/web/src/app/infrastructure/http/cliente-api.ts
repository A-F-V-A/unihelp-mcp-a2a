import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, firstValueFrom, timeout } from 'rxjs';
import { CONFIGURACION_APP } from '../../nucleo/configuracion';
import { mapearFalloHttp } from './http-error.mapper';

/** Tiempo maximo de espera de una peticion a la API. Un agente puede tardar. */
export const TIEMPO_ESPERA_API_MS = 30_000;

/**
 * Envoltorio minimo sobre HttpClient: arma la URL con el `backendUrl` resuelto
 * en ejecucion, aplica timeout y convierte cualquier fallo en `ErrorBackend`.
 */
@Injectable()
export class ClienteApi {
  private readonly http = inject(HttpClient);
  private readonly backendUrl = inject(CONFIGURACION_APP).backendUrl;

  get<T>(ruta: string, params: Record<string, string> = {}): Promise<T> {
    return this.ejecutar(this.http.get<T>(this.url(ruta), { params }));
  }

  post<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return this.ejecutar(this.http.post<T>(this.url(ruta), cuerpo));
  }

  delete<T>(ruta: string): Promise<T> {
    return this.ejecutar(this.http.delete<T>(this.url(ruta)));
  }

  private url(ruta: string): string {
    return `${this.backendUrl}${ruta}`;
  }

  private async ejecutar<T>(peticion: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(peticion.pipe(timeout(TIEMPO_ESPERA_API_MS)));
    } catch (fallo) {
      throw mapearFalloHttp(fallo);
    }
  }
}

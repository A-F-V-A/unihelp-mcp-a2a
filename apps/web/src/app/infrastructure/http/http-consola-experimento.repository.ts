import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  type EstadoConsolaDto,
  type EventoTrabajoDto,
  type LanzarAnalisisDto,
  type LanzarCorridaDto,
  RUTAS_CONSOLA,
  type TrabajoDto,
} from '@unihelp/contratos';
import { type Observable, firstValueFrom, timeout } from 'rxjs';
import type {
  EstadoConsola,
  EventoTrabajo,
  Trabajo,
} from '../../domain/models/experimento/trabajo-consola';
import type { ConsolaExperimentoRepository } from '../../domain/ports/consola-experimento.repository';
import type { SeleccionCorrida } from '../../domain/rules/experimento/comando-corrida.rules';
import { CONFIGURACION_APP } from '../../nucleo/configuracion';
import {
  mapearEstadoConsola,
  mapearEventoTrabajo,
  mapearTrabajo,
} from '../mappers/experimento/consola.mapper';
import { mapearFalloHttp } from './http-error.mapper';

/** La consola responde al instante: lo lento ocurre despues, en el flujo de eventos. */
const TIEMPO_ESPERA_MS = 15_000;

/**
 * Habla con `apps/consola-experimento` en `consolaUrl` (decision 39). Es
 * distinto de `ClienteApi` porque la consola vive en otro origen que el
 * backend de triaje y sus rutas no llevan `/api`.
 */
@Injectable()
export class HttpConsolaExperimentoRepository implements ConsolaExperimentoRepository {
  private readonly http = inject(HttpClient);
  private readonly consolaUrl = inject(CONFIGURACION_APP).consolaUrl;

  async estado(): Promise<EstadoConsola> {
    return mapearEstadoConsola(
      await this.ejecutar(this.http.get<EstadoConsolaDto>(this.url(RUTAS_CONSOLA.estado))),
    );
  }

  async lanzarCorrida(seleccion: SeleccionCorrida): Promise<Trabajo> {
    const cuerpo: LanzarCorridaDto = {
      arquitecturas: seleccion.arquitecturas,
      tareas: seleccion.tareas,
      repeticiones: seleccion.repeticiones,
      modoLlm: seleccion.modoLlm,
      nombre: seleccion.nombre,
    };
    return mapearTrabajo(
      await this.ejecutar(this.http.post<TrabajoDto>(this.url(RUTAS_CONSOLA.corridas), cuerpo)),
    );
  }

  async lanzarAnalisis(corrida: string): Promise<Trabajo> {
    const cuerpo: LanzarAnalisisDto = { corrida };
    return mapearTrabajo(
      await this.ejecutar(this.http.post<TrabajoDto>(this.url(RUTAS_CONSOLA.analisis), cuerpo)),
    );
  }

  async cancelar(trabajoId: string): Promise<Trabajo> {
    return mapearTrabajo(
      await this.ejecutar(
        this.http.post<TrabajoDto>(this.url(RUTAS_CONSOLA.cancelar(trabajoId)), {}),
      ),
    );
  }

  seguir(trabajoId: string, alRecibir: (evento: EventoTrabajo) => void): () => void {
    const fuente = new EventSource(this.url(RUTAS_CONSOLA.eventos(trabajoId)));
    fuente.onmessage = (mensaje: MessageEvent<string>) => {
      const evento = mapearEventoTrabajo(JSON.parse(mensaje.data) as EventoTrabajoDto);
      alRecibir(evento);
      if (evento.tipo === 'fin') {
        fuente.close();
      }
    };
    // El servidor cierra el flujo tras `fin`; un error despues de eso no es un fallo.
    fuente.onerror = () => {
      if (fuente.readyState === EventSource.CLOSED) {
        return;
      }
    };
    return () => fuente.close();
  }

  private url(ruta: string): string {
    return `${this.consolaUrl}${ruta}`;
  }

  private async ejecutar<T>(peticion: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(peticion.pipe(timeout(TIEMPO_ESPERA_MS)));
    } catch (fallo) {
      throw mapearFalloHttp(fallo);
    }
  }
}

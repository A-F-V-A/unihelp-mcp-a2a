import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  type AdjudicacionDto,
  type CalificacionDto,
  type EstadoAdjudicacionDto,
  type MuestraRevisionDto,
  type NuevaAdjudicacionDto,
  type NuevaCalificacionDto,
  type ProgresoRevisorDto,
  RUTAS_REVISION,
} from '@unihelp/contratos';
import { type Observable, firstValueFrom, timeout } from 'rxjs';
import type {
  Adjudicacion,
  Calificacion,
  EstadoAdjudicacion,
  MarcasRevision,
  MuestraRevision,
  ProgresoRevisor,
  RolRevisor,
  VeredictoRevision,
} from '../../domain/models/experimento/revision-humana';
import type { RevisionHumanaRepository } from '../../domain/ports/revision-humana.repository';
import {
  mapearAdjudicacion,
  mapearCalificacion,
  mapearEstadoAdjudicacion,
  mapearMuestraRevision,
  mapearProgresoRevisor,
} from '../mappers/experimento/revision.mapper';
import { mapearFalloHttp } from './http-error.mapper';

const TIEMPO_ESPERA_MS = 15_000;

/**
 * Revision humana contra `apps/consola-experimento` por el MISMO ORIGEN de la
 * web (decisiones 56 y 57): el servidor web reenvia `/revision` a la consola de
 * la maquina del equipo. Asi los revisores pueden abrir el panel desde otro
 * equipo (por un tunel HTTPS) sin que su navegador busque un `localhost` propio.
 */
@Injectable()
export class HttpRevisionHumanaRepository implements RevisionHumanaRepository {
  private readonly http = inject(HttpClient);

  async muestra(): Promise<MuestraRevision> {
    return mapearMuestraRevision(
      await this.ejecutar(this.http.get<MuestraRevisionDto>(this.url(RUTAS_REVISION.muestra))),
    );
  }

  async progreso(rol: RolRevisor): Promise<ProgresoRevisor> {
    return mapearProgresoRevisor(
      await this.ejecutar(
        this.http.get<ProgresoRevisorDto>(this.url(RUTAS_REVISION.progreso(rol))),
      ),
    );
  }

  async calificar(
    rol: RolRevisor,
    revisor: string,
    itemId: string,
    marcas: MarcasRevision,
    veredicto: VeredictoRevision,
    comentario: string | null,
  ): Promise<Calificacion> {
    const cuerpo: NuevaCalificacionDto = {
      rol,
      revisor,
      itemId,
      puntosCubiertos: marcas.puntosCubiertos,
      prohibicionesVioladas: marcas.prohibicionesVioladas,
      veredicto,
      comentario,
    };
    return mapearCalificacion(
      await this.ejecutar(
        this.http.post<CalificacionDto>(this.url(RUTAS_REVISION.calificaciones), cuerpo),
      ),
    );
  }

  async adjudicacion(): Promise<EstadoAdjudicacion> {
    return mapearEstadoAdjudicacion(
      await this.ejecutar(
        this.http.get<EstadoAdjudicacionDto>(this.url(RUTAS_REVISION.adjudicacion)),
      ),
    );
  }

  async adjudicar(
    itemId: string,
    veredicto: VeredictoRevision,
    motivo: string,
  ): Promise<Adjudicacion> {
    const cuerpo: NuevaAdjudicacionDto = { itemId, veredicto, motivo };
    return mapearAdjudicacion(
      await this.ejecutar(
        this.http.post<AdjudicacionDto>(this.url(RUTAS_REVISION.adjudicaciones), cuerpo),
      ),
    );
  }

  private url(ruta: string): string {
    return ruta;
  }

  private async ejecutar<T>(peticion: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(peticion.pipe(timeout(TIEMPO_ESPERA_MS)));
    } catch (fallo) {
      throw mapearFalloHttp(fallo);
    }
  }
}

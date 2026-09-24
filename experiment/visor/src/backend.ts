/**
 * Lo que el visor le pide al backend por fuera del navegador: salud,
 * restablecimiento del entorno y la traza parcial. Usa las rutas de
 * `libs/contratos`, las mismas que `experiment/ejecutor/cliente.py`.
 */
import type { APIRequestContext } from '@playwright/test';
import {
  RUTAS_EXPERIMENTO,
  type CorpusConocimientoDto,
  type EntornoRestablecidoDto,
  type RespuestaSalud,
  type RestablecerEntornoDto,
  type TrazaParcialDto,
} from '@unihelp/contratos';

export const RUTA_SALUD = '/health';

export class ErrorBackendVisor extends Error {
  constructor(
    mensaje: string,
    /** `true` si no hubo respuesta o fue 503: el fallo no es del agente (RM-15). */
    readonly deInfraestructura: boolean,
    readonly status: number | null = null,
  ) {
    super(mensaje);
  }
}

export class ClienteBackendVisor {
  constructor(
    private readonly request: APIRequestContext,
    private readonly url: string,
    private readonly timeoutMs: number,
  ) {}

  async salud(): Promise<RespuestaSalud> {
    return this.pedir<RespuestaSalud>('GET', RUTA_SALUD);
  }

  async restablecer(
    estadoInicial: string,
    corpus: CorpusConocimientoDto,
  ): Promise<EntornoRestablecidoDto> {
    const cuerpo: RestablecerEntornoDto = { estadoInicial, corpus };
    return this.pedir<EntornoRestablecidoDto>('POST', RUTAS_EXPERIMENTO.restablecer, cuerpo);
  }

  /** `null` si el backend aun no midio nada con ese trace (o no tiene el perfil experimento). */
  async trazaParcial(traceId: string): Promise<TrazaParcialDto | null> {
    try {
      return await this.pedir<TrazaParcialDto>('GET', RUTAS_EXPERIMENTO.traza(traceId));
    } catch (error) {
      if (error instanceof ErrorBackendVisor && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async pedir<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
    let respuesta;
    try {
      respuesta = await this.request.fetch(`${this.url}${ruta}`, {
        method: metodo,
        data: cuerpo,
        timeout: this.timeoutMs,
      });
    } catch (error) {
      throw new ErrorBackendVisor(`${metodo} ${ruta}: ${String(error)}`, true);
    }
    if (respuesta.status() === 503) {
      throw new ErrorBackendVisor(`${metodo} ${ruta}: 503`, true, 503);
    }
    if (respuesta.status() >= 400) {
      const detalle = (await respuesta.text()).slice(0, 400);
      throw new ErrorBackendVisor(
        `${metodo} ${ruta}: ${respuesta.status()} ${detalle}`,
        false,
        respuesta.status(),
      );
    }
    return (await respuesta.json()) as T;
  }
}

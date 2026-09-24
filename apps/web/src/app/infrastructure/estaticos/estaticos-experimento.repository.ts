import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { RespuestaSalud } from '@unihelp/contratos';
import type { IdentificadorArquitectura } from '@unihelp/dominio';
import { type Observable, firstValueFrom, timeout } from 'rxjs';
import { ErrorBackend } from '../../domain/errors/error-backend';
import type {
  ConfiguracionCorrida,
  SaludBackend,
} from '../../domain/models/experimento/configuracion-corrida';
import type { CatalogoCorridas, CorridaDetallada } from '../../domain/models/experimento/corrida';
import type {
  ManifiestoSalidas,
  ResultadosAnalisis,
} from '../../domain/models/experimento/resultados-analisis';
import type { TareaEvaluacion } from '../../domain/models/experimento/tarea-evaluacion';
import type { ExperimentoRepository } from '../../domain/ports/experimento.repository';
import { ordenarTareas } from '../../domain/rules/experimento/tareas.rules';
import { mapearFalloHttp } from '../http/http-error.mapper';
import {
  mapearCatalogoCorridas,
  mapearCorridaDetallada,
  parsearJsonl,
} from '../mappers/experimento/corrida.mapper';
import {
  mapearConfiguracionCorrida,
  mapearManifiestoSalidas,
  mapearResultados,
} from '../mappers/experimento/resultados.mapper';
import { mapearTareaEvaluacion } from '../mappers/experimento/tarea-evaluacion.mapper';
import type {
  HuellasEsperadasDto,
  IndiceCorridasDto,
  ManifiestoCorridaDto,
  ManifiestoSalidasDto,
  PuntuacionDto,
  ResultadosDto,
  SobreCuarentenaDto,
  TrazaDto,
} from './experimento.dto';

/**
 * Raiz, relativa al `index.html`, de los archivos del experimento (decision 38).
 * En produccion son assets copiados al construir; en desarrollo el servidor los
 * reenvia a la consola del experimento, que los sirve tal cual desde el disco
 * (asi el dev server no recarga la pagina con cada traza que escribe el
 * ejecutor, decision 39).
 */
export const RAIZ_DATOS_EXPERIMENTO = 'datos-experimento';

/** Ids de las 40 tareas del conjunto (docs/10): fijos, asi no hace falta listar el directorio. */
const IDS_TAREAS: readonly string[] = ['INF', 'DIA', 'COM', 'ADV'].flatMap((categoria) =>
  Array.from({ length: 10 }, (_, i) => `T-${categoria}-${String(i + 1).padStart(3, '0')}`),
);

/** Un archivo estatico se sirve al instante; `/health` de un backend caido tarda lo que el navegador. */
const TIEMPO_ESPERA_MS = 20_000;

/**
 * Implementacion de solo lectura del puerto del experimento: `fetch` de
 * archivos estaticos del mismo origen (HU-MET-14). La unica peticion que sale
 * del origen es `/health`, y solo la dispara la persona desde "Preparar corrida".
 */
@Injectable()
export class EstaticosExperimentoRepository implements ExperimentoRepository {
  private readonly http = inject(HttpClient);

  async listarTareas(): Promise<readonly TareaEvaluacion[]> {
    const parsearYaml = await cargarParserYaml();
    const tareas = await Promise.all(
      IDS_TAREAS.map(async (id) =>
        mapearTareaEvaluacion(parsearYaml(await this.texto(`tareas/${id}.yaml`))),
      ),
    );
    return ordenarTareas(tareas);
  }

  async listarCorridas(): Promise<CatalogoCorridas> {
    return mapearCatalogoCorridas(await this.json<IndiceCorridasDto>('corridas/indice.json'));
  }

  async obtenerCorrida(nombre: string): Promise<CorridaDetallada> {
    const base = `corridas/${encodeURIComponent(nombre)}`;
    const existentes = await this.archivosDeCorrida(nombre);
    // Los archivos opcionales solo se piden si el catalogo dice que existen:
    // asi el navegador no registra un 404 por cada corrida sin reejecuciones.
    const opcional = <T>(archivo: string, leer: () => Promise<T>, respaldo: T): Promise<T> =>
      existentes !== null && !existentes.includes(archivo)
        ? Promise.resolve(respaldo)
        : leer().catch(siFalta(respaldo));
    const [trazas, puntuaciones, manifiesto, cuarentena, huellas, reejecuciones] =
      await Promise.all([
        this.texto(`${base}/trazas.jsonl`),
        opcional('puntuaciones.jsonl', () => this.texto(`${base}/puntuaciones.jsonl`), ''),
        opcional<ManifiestoCorridaDto | null>(
          'manifiesto.json',
          () => this.json<ManifiestoCorridaDto>(`${base}/manifiesto.json`),
          null,
        ),
        opcional(
          'cuarentena/trazas.jsonl',
          () => this.texto(`${base}/cuarentena/trazas.jsonl`),
          '',
        ),
        opcional<HuellasEsperadasDto | null>(
          'huellas-esperadas.json',
          () => this.json<HuellasEsperadasDto>(`${base}/huellas-esperadas.json`),
          null,
        ),
        opcional<string | null>(
          'reejecuciones.md',
          () => this.texto(`${base}/reejecuciones.md`),
          null,
        ),
      ]);
    return mapearCorridaDetallada({
      nombre,
      manifiesto,
      trazas: parsearJsonl<TrazaDto>(trazas, 'trazas.jsonl'),
      cuarentena: parsearJsonl<SobreCuarentenaDto>(cuarentena, 'cuarentena/trazas.jsonl'),
      puntuaciones: parsearJsonl<PuntuacionDto>(puntuaciones, 'puntuaciones.jsonl'),
      huellas,
      reejecuciones,
    });
  }

  /** Archivos de una corrida segun `indice.json`; `null` si no hay catalogo (se intentan todos). */
  private async archivosDeCorrida(nombre: string): Promise<readonly string[] | null> {
    try {
      const indice = await this.json<IndiceCorridasDto>('corridas/indice.json');
      return indice.corridas.find((c) => c.nombre === nombre)?.archivos ?? null;
    } catch {
      return null;
    }
  }

  async obtenerResultados(): Promise<ResultadosAnalisis> {
    return mapearResultados(await this.json<ResultadosDto>('salidas/resultados.json'));
  }

  async obtenerManifiestoSalidas(): Promise<ManifiestoSalidas> {
    return mapearManifiestoSalidas(
      await this.json<ManifiestoSalidasDto>('salidas/manifiesto.json'),
    );
  }

  urlSalida(archivo: string): string {
    return `${RAIZ_DATOS_EXPERIMENTO}/salidas/${encodeURIComponent(archivo)}`;
  }

  async obtenerConfiguracionCorrida(): Promise<ConfiguracionCorrida> {
    const parsearYaml = await cargarParserYaml();
    return mapearConfiguracionCorrida(parsearYaml(await this.texto('ejecutor/corrida.yaml')));
  }

  async consultarSalud(
    arquitectura: IdentificadorArquitectura,
    url: string,
  ): Promise<SaludBackend> {
    const base = url.replace(/\/+$/, '');
    const salud = await this.ejecutar(this.http.get<RespuestaSalud>(`${base}/health`));
    if (salud.arquitectura !== arquitectura) {
      // Igual que `ejecutor salud`: no se corre B1 contra un proceso de B0 levantado por error.
      throw new ErrorBackend(
        'conflicto',
        `El backend de ${base} responde como ${salud.arquitectura}, no como ${arquitectura}.`,
      );
    }
    return {
      url: base,
      arquitectura: salud.arquitectura,
      servicio: salud.servicio,
      version: salud.version,
      consultadaEn: new Date(),
    };
  }

  private async json<T>(ruta: string): Promise<T> {
    const contenido = await this.texto(ruta);
    try {
      return JSON.parse(contenido) as T;
    } catch {
      throw new ErrorBackend('validacion', `${ruta}: el archivo no es JSON valido.`);
    }
  }

  private async texto(ruta: string): Promise<string> {
    const contenido = await this.ejecutar(
      this.http.get(`${RAIZ_DATOS_EXPERIMENTO}/${ruta}`, { responseType: 'text' }),
    );
    // nginx responde el index.html (200) a cualquier ruta que no existe (SPA):
    // un HTML donde se esperaba un archivo de datos es "no existe", no un dato.
    if (/^\s*<(!doctype|html)/i.test(contenido)) {
      throw noEncontrado();
    }
    return contenido;
  }

  private async ejecutar<T>(peticion: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(peticion.pipe(timeout(TIEMPO_ESPERA_MS)));
    } catch (fallo) {
      if (fallo instanceof HttpErrorResponse && fallo.status === 404) {
        throw noEncontrado();
      }
      // En desarrollo el servidor reenvia `datos-experimento/` a la consola del
      // experimento (proxy.conf.json); si esta apagada, el proxy responde 5xx.
      if (fallo instanceof HttpErrorResponse && [502, 503, 504].includes(fallo.status)) {
        throw new ErrorBackend(
          'servicio-no-disponible',
          'La consola del experimento no responde: levántala con `pnpm dev:consola` (en desarrollo, ella sirve los archivos del experimento).',
        );
      }
      throw mapearFalloHttp(fallo);
    }
  }
}

function noEncontrado(): ErrorBackend {
  return new ErrorBackend('no-encontrado', 'El archivo todavia no existe.', { status: 404 });
}

/**
 * El parser YAML solo lo necesita el panel: se carga bajo demanda para que el
 * chat no lo pague en el arranque (presupuesto inicial de 500 kB).
 */
async function cargarParserYaml(): Promise<(texto: string) => unknown> {
  const { parse } = await import('yaml');
  return (texto) => parse(texto);
}

/** Un archivo opcional que no existe no es un error: se devuelve el valor de respaldo. */
function siFalta<T>(respaldo: T): (fallo: unknown) => T {
  return (fallo) => {
    if (fallo instanceof ErrorBackend && fallo.codigo === 'no-encontrado') {
      return respaldo;
    }
    throw fallo;
  };
}

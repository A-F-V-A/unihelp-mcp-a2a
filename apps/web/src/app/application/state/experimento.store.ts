import { Injectable, computed, inject, signal } from '@angular/core';
import type { IdentificadorArquitectura } from '@unihelp/dominio';
import { normalizarError } from '../../domain/errors/error-backend';
import type {
  ConfiguracionCorrida,
  SaludBackend,
} from '../../domain/models/experimento/configuracion-corrida';
import type { CatalogoCorridas, CorridaDetallada } from '../../domain/models/experimento/corrida';
import type { TareaEvaluacion } from '../../domain/models/experimento/tarea-evaluacion';
import {
  type FiltroTareas,
  FILTRO_TAREAS_VACIO,
  filtrarTareas,
} from '../../domain/rules/experimento/tareas.rules';
import { CargarCorridasUseCase } from '../use-cases/experimento/cargar-corridas.use-case';
import {
  CargarResultadosUseCase,
  type ResultadosPublicados,
} from '../use-cases/experimento/cargar-resultados.use-case';
import { CargarTareasUseCase } from '../use-cases/experimento/cargar-tareas.use-case';
import { PrepararCorridaUseCase } from '../use-cases/experimento/preparar-corrida.use-case';

/** Estado de un archivo que se lee bajo demanda. `ausente` = todavia no existe (no se ha corrido nada). */
export interface Recurso<T> {
  readonly cargando: boolean;
  readonly valor: T | null;
  readonly error: string | null;
  readonly ausente: boolean;
}

const RECURSO_INICIAL: Recurso<never> = {
  cargando: false,
  valor: null,
  error: null,
  ausente: false,
};

export interface EstadoBackend {
  readonly comprobando: boolean;
  readonly salud: SaludBackend | null;
  readonly error: string | null;
}

/**
 * Estado del panel del experimento: tareas, catalogo de corridas, la corrida
 * abierta, los resultados del cuaderno y la configuracion del ejecutor. Todo
 * es lectura de archivos ya escritos (HU-MET-14): no hay ninguna accion que
 * modifique trazas, resultados ni configuracion.
 */
@Injectable({ providedIn: 'root' })
export class ExperimentoStore {
  private readonly cargarTareas = inject(CargarTareasUseCase);
  private readonly corridas = inject(CargarCorridasUseCase);
  private readonly cargarResultados = inject(CargarResultadosUseCase);
  private readonly preparar = inject(PrepararCorridaUseCase);

  private readonly _tareas = signal<Recurso<readonly TareaEvaluacion[]>>(RECURSO_INICIAL);
  private readonly _filtroTareas = signal<FiltroTareas>(FILTRO_TAREAS_VACIO);
  private readonly _catalogo = signal<Recurso<CatalogoCorridas>>(RECURSO_INICIAL);
  private readonly _corrida = signal<Recurso<CorridaDetallada>>(RECURSO_INICIAL);
  private readonly _resultados = signal<Recurso<ResultadosPublicados>>(RECURSO_INICIAL);
  private readonly _configuracion = signal<Recurso<ConfiguracionCorrida>>(RECURSO_INICIAL);
  private readonly _backends = signal<
    Readonly<Partial<Record<IdentificadorArquitectura, EstadoBackend>>>
  >({});
  /** Ids que el explorador de tareas dejo elegidos para "Preparar corrida"; `null` = todas. */
  private readonly _tareasPreparadas = signal<readonly string[] | null>(null);

  readonly tareas = this._tareas.asReadonly();
  readonly filtroTareas = this._filtroTareas.asReadonly();
  readonly catalogo = this._catalogo.asReadonly();
  readonly corrida = this._corrida.asReadonly();
  readonly resultados = this._resultados.asReadonly();
  readonly configuracion = this._configuracion.asReadonly();
  readonly backends = this._backends.asReadonly();
  readonly tareasPreparadas = this._tareasPreparadas.asReadonly();

  readonly tareasFiltradas = computed(() =>
    filtrarTareas(this._tareas().valor ?? [], this._filtroTareas()),
  );
  readonly tareasPorId = computed(
    () => new Map((this._tareas().valor ?? []).map((tarea) => [tarea.id, tarea])),
  );

  async iniciarTareas(): Promise<void> {
    if (this._tareas().valor || this._tareas().cargando) {
      return;
    }
    await this.leer(this._tareas, () => this.cargarTareas.ejecutar());
  }

  cambiarFiltroTareas(cambios: Partial<FiltroTareas>): void {
    this._filtroTareas.update((filtro) => ({ ...filtro, ...cambios }));
  }

  limpiarFiltroTareas(): void {
    this._filtroTareas.set(FILTRO_TAREAS_VACIO);
  }

  /** Lleva una seleccion de tareas a "Preparar corrida" sin ensuciar la URL. */
  prepararConTareas(ids: readonly string[] | null): void {
    this._tareasPreparadas.set(ids ? [...ids] : null);
  }

  tarea(id: string): TareaEvaluacion | null {
    return this.tareasPorId().get(id) ?? null;
  }

  async cargarCatalogo(): Promise<void> {
    await this.leer(this._catalogo, () => this.corridas.listar());
  }

  async abrirCorrida(nombre: string): Promise<void> {
    if (this._corrida().valor?.nombre === nombre && !this._corrida().error) {
      return;
    }
    this._corrida.set(RECURSO_INICIAL);
    await this.leer(this._corrida, () => this.corridas.detalle(nombre));
  }

  async cargarResultadosPublicados(): Promise<void> {
    await this.leer(this._resultados, () => this.cargarResultados.ejecutar());
  }

  urlSalida(archivo: string): string {
    return this.cargarResultados.urlSalida(archivo);
  }

  async cargarConfiguracion(): Promise<void> {
    if (this._configuracion().valor || this._configuracion().cargando) {
      return;
    }
    await this.leer(this._configuracion, () => this.preparar.configuracion());
  }

  /** `GET /health` de un backend. Es la unica peticion que sale del origen y la dispara la persona. */
  async comprobarBackend(arquitectura: IdentificadorArquitectura, url: string): Promise<void> {
    this._backends.update((estado) => ({
      ...estado,
      [arquitectura]: { comprobando: true, salud: null, error: null },
    }));
    try {
      const salud = await this.preparar.comprobarBackend(arquitectura, url);
      this._backends.update((estado) => ({
        ...estado,
        [arquitectura]: { comprobando: false, salud, error: null },
      }));
    } catch (fallo) {
      this._backends.update((estado) => ({
        ...estado,
        [arquitectura]: { comprobando: false, salud: null, error: normalizarError(fallo).message },
      }));
    }
  }

  private async leer<T>(
    destino: ReturnType<typeof signal<Recurso<T>>>,
    cargar: () => Promise<T>,
  ): Promise<void> {
    destino.update((recurso) => ({ ...recurso, cargando: true, error: null, ausente: false }));
    try {
      destino.set({ cargando: false, valor: await cargar(), error: null, ausente: false });
    } catch (fallo) {
      const error = normalizarError(fallo);
      destino.set({
        cargando: false,
        valor: null,
        error: error.message,
        ausente: error.codigo === 'no-encontrado',
      });
    }
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { normalizarError } from '../../domain/errors/error-backend';
import type {
  Calificacion,
  EstadoAdjudicacion,
  ItemRevision,
  MarcasRevision,
  MuestraRevision,
  RolRevisor,
  VeredictoRevision,
} from '../../domain/models/experimento/revision-humana';
import {
  alternarMarca,
  motivosReprobacion,
  siguientePendiente,
  ultimasPorItem,
  validarRevisor,
  veredictoSegunRubrica,
} from '../../domain/rules/experimento/revision.rules';
import { RevisionHumanaUseCase } from '../use-cases/experimento/revision-humana.use-case';

export type EtapaRevision = 'inicio' | 'calificando' | 'terminado';

const MARCAS_VACIAS: MarcasRevision = { puntosCubiertos: [], prohibicionesVioladas: [] };

/**
 * Estado de la revision humana (M7.4, M7.5; decision 56): quien califica, la
 * muestra ciega, sus propias calificaciones y el borrador del item abierto. El
 * veredicto del borrador lo deriva la rubrica en vivo; la persona solo marca.
 */
@Injectable({ providedIn: 'root' })
export class RevisionStore {
  private readonly revision = inject(RevisionHumanaUseCase);

  private readonly _etapa = signal<EtapaRevision>('inicio');
  private readonly _rol = signal<RolRevisor>('A');
  private readonly _revisor = signal('');
  private readonly _muestra = signal<MuestraRevision | null>(null);
  private readonly _calificaciones = signal<ReadonlyMap<string, Calificacion>>(new Map());
  private readonly _indice = signal(0);
  private readonly _marcas = signal<MarcasRevision>(MARCAS_VACIAS);
  private readonly _comentario = signal('');
  private readonly _cargando = signal(false);
  private readonly _guardando = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _adjudicacion = signal<EstadoAdjudicacion | null>(null);

  readonly etapa = this._etapa.asReadonly();
  readonly rol = this._rol.asReadonly();
  readonly revisor = this._revisor.asReadonly();
  readonly muestra = this._muestra.asReadonly();
  readonly indice = this._indice.asReadonly();
  readonly marcas = this._marcas.asReadonly();
  readonly comentario = this._comentario.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly guardando = this._guardando.asReadonly();
  readonly error = this._error.asReadonly();
  readonly adjudicacion = this._adjudicacion.asReadonly();

  readonly items = computed(() => this._muestra()?.items ?? []);
  readonly item = computed<ItemRevision | null>(() => this.items()[this._indice()] ?? null);
  readonly total = computed(() => this.items().length);
  readonly calificadas = computed(() => this._calificaciones().size);
  readonly calificacionActual = computed(() => {
    const item = this.item();
    return item ? (this._calificaciones().get(item.id) ?? null) : null;
  });
  readonly veredicto = computed<VeredictoRevision | null>(() => {
    const item = this.item();
    return item ? veredictoSegunRubrica(item, this._marcas()) : null;
  });
  readonly motivos = computed(() => {
    const item = this.item();
    return item ? motivosReprobacion(item, this._marcas()) : [];
  });
  /** Estado de cada item para la tira de avance: calificado o pendiente. */
  readonly mapa = computed(() =>
    this.items().map((item, indice) => ({
      id: item.id,
      indice,
      calificado: this._calificaciones().has(item.id),
      veredicto: this._calificaciones().get(item.id)?.veredicto ?? null,
    })),
  );

  /** Carga la muestra y lo ya calificado por ese rol; se retoma en el primer pendiente. */
  async iniciar(rol: RolRevisor, nombre: string): Promise<void> {
    const validacion = validarRevisor(nombre);
    if (!validacion.valido) {
      this._error.set(validacion.mensaje);
      return;
    }
    this._cargando.set(true);
    this._error.set(null);
    try {
      const [muestra, progreso] = await Promise.all([
        this.revision.muestra(),
        this.revision.progreso(rol),
      ]);
      if (progreso.revisor && progreso.revisor !== validacion.nombre) {
        this._error.set(
          `El rol ${rol} ya lo tomó ${progreso.revisor}. Si eres tú, escribe el mismo nombre; si no, elige el otro rol.`,
        );
        return;
      }
      this._rol.set(rol);
      this._revisor.set(validacion.nombre);
      this._muestra.set(muestra);
      this._calificaciones.set(ultimasPorItem(progreso.calificaciones));
      const pendiente = siguientePendiente(muestra.items, new Set(this._calificaciones().keys()));
      this._etapa.set(pendiente === null ? 'terminado' : 'calificando');
      this.abrir(pendiente ?? 0);
    } catch (fallo) {
      this._error.set(normalizarError(fallo).message);
    } finally {
      this._cargando.set(false);
    }
  }

  /** Abre un item; si ya estaba calificado, carga sus marcas para revisarlas o corregirlas. */
  abrir(indice: number): void {
    const items = this.items();
    if (items.length === 0) {
      return;
    }
    const acotado = Math.min(Math.max(indice, 0), items.length - 1);
    this._indice.set(acotado);
    const previa = this._calificaciones().get(items[acotado].id);
    this._marcas.set(
      previa
        ? {
            puntosCubiertos: previa.puntosCubiertos,
            prohibicionesVioladas: previa.prohibicionesVioladas,
          }
        : MARCAS_VACIAS,
    );
    this._comentario.set(previa?.comentario ?? '');
    this._error.set(null);
  }

  alternarPunto(numero: number): void {
    this._marcas.update((m) => ({
      ...m,
      puntosCubiertos: alternarMarca(m.puntosCubiertos, numero),
    }));
  }

  alternarProhibicion(numero: number): void {
    this._marcas.update((m) => ({
      ...m,
      prohibicionesVioladas: alternarMarca(m.prohibicionesVioladas, numero),
    }));
  }

  fijarComentario(texto: string): void {
    this._comentario.set(texto);
  }

  /** Guarda el item abierto y salta al siguiente pendiente; si no quedan, termina. */
  async guardarYSeguir(): Promise<boolean> {
    const item = this.item();
    if (!item || this._guardando()) {
      return false;
    }
    this._guardando.set(true);
    this._error.set(null);
    try {
      const guardada = await this.revision.calificar(
        this._rol(),
        this._revisor(),
        item,
        this._marcas(),
        this._comentario(),
      );
      const nuevas = new Map(this._calificaciones());
      nuevas.set(item.id, guardada);
      this._calificaciones.set(nuevas);
      const pendiente = siguientePendiente(
        this.items(),
        new Set(nuevas.keys()),
        this._indice() + 1,
      );
      if (pendiente === null) {
        this._etapa.set('terminado');
      } else {
        this.abrir(pendiente);
      }
      return true;
    } catch (fallo) {
      this._error.set(normalizarError(fallo).message);
      return false;
    } finally {
      this._guardando.set(false);
    }
  }

  /** Vuelve a la muestra para revisar o corregir lo ya calificado. */
  revisarDeNuevo(indice = 0): void {
    this._etapa.set('calificando');
    this.abrir(indice);
  }

  salir(): void {
    this._etapa.set('inicio');
    this._muestra.set(null);
    this._calificaciones.set(new Map());
    this._error.set(null);
  }

  async cargarAdjudicacion(): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);
    try {
      this._adjudicacion.set(await this.revision.adjudicacion());
    } catch (fallo) {
      this._error.set(normalizarError(fallo).message);
    } finally {
      this._cargando.set(false);
    }
  }

  async adjudicar(itemId: string, veredicto: VeredictoRevision, motivo: string): Promise<boolean> {
    this._guardando.set(true);
    this._error.set(null);
    try {
      await this.revision.adjudicar(itemId, veredicto, motivo);
      this._adjudicacion.set(await this.revision.adjudicacion());
      return true;
    } catch (fallo) {
      this._error.set(normalizarError(fallo).message);
      return false;
    } finally {
      this._guardando.set(false);
    }
  }
}

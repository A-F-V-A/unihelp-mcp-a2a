import { Injectable, computed, inject, signal } from '@angular/core';
import { normalizarError } from '../../domain/errors/error-backend';
import type {
  EstadoConsola,
  EventoTrabajo,
  Trabajo,
} from '../../domain/models/experimento/trabajo-consola';
import type { SeleccionCorrida } from '../../domain/rules/experimento/comando-corrida.rules';
import { leerProgreso } from '../../domain/rules/experimento/progreso-corrida.rules';
import { OperarConsolaUseCase } from '../use-cases/experimento/operar-consola.use-case';

export type DisponibilidadConsola = 'desconocida' | 'consultando' | 'disponible' | 'ausente';

/**
 * Estado de la consola del experimento en el panel: si responde, que trabajo
 * corre y su salida en vivo (decision 39). El progreso se lee de los renglones
 * del ejecutor; ninguna cifra se calcula aqui (RM-02).
 */
@Injectable({ providedIn: 'root' })
export class ConsolaStore {
  private readonly consola = inject(OperarConsolaUseCase);

  private readonly _disponibilidad = signal<DisponibilidadConsola>('desconocida');
  private readonly _detalle = signal<EstadoConsola | null>(null);
  private readonly _trabajo = signal<Trabajo | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _lanzando = signal(false);
  private dejarDeSeguir: (() => void) | null = null;

  readonly disponibilidad = this._disponibilidad.asReadonly();
  readonly detalle = this._detalle.asReadonly();
  readonly trabajo = this._trabajo.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lanzando = this._lanzando.asReadonly();

  readonly enMarcha = computed(() => this._trabajo()?.estado === 'en_marcha');
  readonly progreso = computed(() => leerProgreso(this._trabajo()?.lineas ?? []));

  /** Pregunta si la consola responde; si hay un trabajo en marcha, se engancha a el. */
  async comprobar(): Promise<void> {
    this._disponibilidad.set('consultando');
    try {
      const estado = await this.consola.estado();
      this._detalle.set(estado);
      this._disponibilidad.set('disponible');
      this._error.set(null);
      if (estado.trabajo) {
        this.adoptar(estado.trabajo);
      }
    } catch (fallo) {
      this._disponibilidad.set('ausente');
      this._detalle.set(null);
      this._error.set(normalizarError(fallo).message);
    }
  }

  async lanzarCorrida(seleccion: SeleccionCorrida): Promise<boolean> {
    return this.lanzar(() => this.consola.lanzarCorrida(seleccion));
  }

  async lanzarAnalisis(corrida: string): Promise<boolean> {
    return this.lanzar(() => this.consola.lanzarAnalisis(corrida));
  }

  async cancelar(): Promise<void> {
    const trabajo = this._trabajo();
    if (!trabajo || trabajo.estado !== 'en_marcha') {
      return;
    }
    try {
      await this.consola.cancelar(trabajo.id);
    } catch (fallo) {
      this._error.set(normalizarError(fallo).message);
    }
  }

  /** Suelta el trabajo terminado para poder lanzar otro desde una pantalla limpia. */
  descartar(): void {
    if (this._trabajo()?.estado === 'en_marcha') {
      return;
    }
    this.soltar();
    this._trabajo.set(null);
    this._error.set(null);
  }

  private async lanzar(accion: () => Promise<Trabajo>): Promise<boolean> {
    this._lanzando.set(true);
    this._error.set(null);
    try {
      this.adoptar(await accion());
      return true;
    } catch (fallo) {
      this._error.set(normalizarError(fallo).message);
      return false;
    } finally {
      this._lanzando.set(false);
    }
  }

  private adoptar(trabajo: Trabajo): void {
    this.soltar();
    this._trabajo.set(trabajo);
    if (trabajo.estado === 'en_marcha') {
      // El flujo reproduce lo ya emitido: se parte de cero para no duplicar lineas.
      this._trabajo.set({ ...trabajo, lineas: [] });
      this.dejarDeSeguir = this.consola.seguir(trabajo.id, (evento) => this.recibir(evento));
    }
  }

  private recibir(evento: EventoTrabajo): void {
    if (evento.tipo === 'fin') {
      this._trabajo.set(evento.trabajo);
      this.soltar();
      return;
    }
    this._trabajo.update((actual) =>
      actual ? { ...actual, lineas: [...actual.lineas, evento.linea] } : actual,
    );
  }

  private soltar(): void {
    this.dejarDeSeguir?.();
    this.dejarDeSeguir = null;
  }
}

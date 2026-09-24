import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsolaStore } from '../../../../application/state/consola.store';
import { ExperimentoStore } from '../../../../application/state/experimento.store';
import type { EstadoTrabajo } from '../../../../domain/models/experimento/trabajo-consola';
import { interpretarMotivo } from '../../../../domain/rules/experimento/ejecuciones.rules';
import { claseArquitectura, formatearFechaHora } from '../../shared/etiquetas-experimento';

const ETIQUETA_ESTADO: Readonly<Record<EstadoTrabajo, string>> = {
  en_marcha: 'En marcha',
  terminado: 'Terminó',
  fallido: 'Falló',
  cancelado: 'Cancelado',
};

const CLASE_ESTADO: Readonly<Record<EstadoTrabajo, string>> = {
  en_marcha: 'chip--pendiente',
  terminado: 'chip--alcanza',
  fallido: 'chip--no-alcanza',
  cancelado: 'chip--sin-datos',
};

/** Lineas que se muestran del registro; el resto sigue disponible en la consola. */
const LINEAS_VISIBLES = 400;

/**
 * Seguimiento en vivo del trabajo de la consola: progreso ejecucion por
 * ejecucion, el registro del proceso y, al terminar, los enlaces a la corrida
 * y al calculo de resultados (decision 39). Lee el `ConsolaStore`; no decide
 * nada sobre las cifras.
 */
@Component({
  selector: 'app-job-monitor',
  imports: [RouterLink],
  templateUrl: './job-monitor.html',
  styleUrl: './job-monitor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobMonitor {
  private readonly consola = inject(ConsolaStore);
  private readonly experimento = inject(ExperimentoStore);

  protected readonly trabajo = this.consola.trabajo;
  protected readonly progreso = this.consola.progreso;
  protected readonly enMarcha = this.consola.enMarcha;
  protected readonly lanzando = this.consola.lanzando;
  protected readonly error = this.consola.error;
  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly claseEstado = CLASE_ESTADO;
  protected readonly claseArquitectura = claseArquitectura;
  protected readonly formatearFechaHora = formatearFechaHora;
  protected readonly interpretarMotivo = interpretarMotivo;

  private readonly registro = viewChild<ElementRef<HTMLElement>>('registro');

  protected readonly nombreCorrida = computed(
    () => this.trabajo()?.corrida ?? this.progreso().corrida,
  );
  protected readonly lineasVisibles = computed(() =>
    (this.trabajo()?.lineas ?? []).slice(-LINEAS_VISIBLES),
  );
  protected readonly porcentaje = computed(() => {
    const p = this.progreso();
    return p.total ? Math.min(100, Math.round((p.ejecuciones.length / p.total) * 100)) : null;
  });
  protected readonly tituloTarea = (id: string) => this.experimento.tarea(id)?.titulo ?? '';

  constructor() {
    // El registro sigue la ultima linea mientras el trabajo corre.
    afterRenderEffect(() => {
      this.lineasVisibles();
      const elemento = this.registro()?.nativeElement;
      if (elemento && this.enMarcha()) {
        elemento.scrollTop = elemento.scrollHeight;
      }
    });
  }

  protected cancelar(): void {
    void this.consola.cancelar();
  }

  protected descartar(): void {
    this.consola.descartar();
  }

  protected calcularResultados(): void {
    const corrida = this.nombreCorrida();
    if (corrida) {
      void this.consola.lanzarAnalisis(corrida).then(() => this.experimento.cargarCatalogo());
    }
  }

  protected async recargarResultados(): Promise<void> {
    await this.experimento.cargarResultadosPublicados();
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExperimentoStore } from '../../../../application/state/experimento.store';
import { claseArquitectura, formatearFechaHora } from '../../shared/etiquetas-experimento';
import { EstadoRecurso } from '../../shared/estado-recurso/estado-recurso';

/**
 * Catalogo de corridas del ejecutor (`corridas/indice.json`). Los conteos que
 * se muestran son los del manifiesto que escribio el ejecutor; las tasas y los
 * intervalos viven en Resultados, calculados por el cuaderno (RM-02).
 */
@Component({
  selector: 'app-run-list',
  imports: [RouterLink, EstadoRecurso],
  templateUrl: './run-list.html',
  styleUrl: './run-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunList {
  private readonly store = inject(ExperimentoStore);

  protected readonly catalogo = this.store.catalogo;
  protected readonly claseArquitectura = claseArquitectura;
  protected readonly formatearFechaHora = formatearFechaHora;

  constructor() {
    void this.store.cargarCatalogo();
  }

  protected recargar(): void {
    void this.store.cargarCatalogo();
  }
}

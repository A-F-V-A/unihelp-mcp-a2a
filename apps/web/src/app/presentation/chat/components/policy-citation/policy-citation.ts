import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { EstadoRecurso } from '../../../../application/state/conversacion.store';
import type { CitaPolitica, Politica } from '../../../../domain/models/politica';
import { FechaPipe } from '../../../shared/fecha.pipe';
import { nombreServicio } from '../../../shared/formato';

/** Cita de politica con codigo y version siempre visibles (HU-FE-12). */
@Component({
  selector: 'app-policy-citation',
  imports: [FechaPipe],
  templateUrl: './policy-citation.html',
  styleUrl: './policy-citation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyCitation {
  readonly cita = input.required<CitaPolitica>();
  /** Texto completo, cargado bajo demanda. */
  readonly detalle = input<EstadoRecurso<Politica> | null>(null);
  readonly consultar = output<void>();

  protected readonly expandida = signal(false);
  protected readonly area = computed(() => nombreServicio(this.cita().area));

  protected alternar(): void {
    const expandir = !this.expandida();
    this.expandida.set(expandir);
    if (expandir && !this.detalle()?.valor) {
      this.consultar.emit();
    }
  }
}

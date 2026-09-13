import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ErrorVista } from '../../../../application/state/conversacion.store';
import type { EstadoServicio } from '../../../../domain/models/servicio';
import { FechaPipe } from '../../../shared/fecha.pipe';
import { ETIQUETA_NIVEL_SERVICIO, formatearVentana } from '../../../shared/formato';

/** Estado, componente afectado, alcance y ventana estimada de un servicio (HU-FE-14). */
@Component({
  selector: 'app-service-status-card',
  imports: [FechaPipe],
  templateUrl: './service-status-card.html',
  styleUrl: './service-status-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceStatusCard {
  readonly estado = input.required<EstadoServicio>();
  readonly actualizando = input(false);
  readonly error = input<ErrorVista | null>(null);
  readonly actualizar = output<void>();

  protected readonly nivel = computed(() => this.estado().estado);
  protected readonly etiquetaNivel = computed(() => ETIQUETA_NIVEL_SERVICIO[this.nivel()]);
  protected readonly ventana = computed(() => {
    const ventana = this.estado().ventanaEstimada;
    return ventana ? formatearVentana(ventana) : null;
  });
  /** Nunca se deja el campo vacio: se explica por que no hay ventana. */
  protected readonly textoSinVentana = computed(() =>
    this.nivel() === 'operativo'
      ? 'No aplica: el servicio opera con normalidad.'
      : 'Sin ventana estimada todavía: el equipo aún no ha definido cuándo se restablece.',
  );
}

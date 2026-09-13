import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EstadoServicio } from '../../../../domain/models/servicio';
import { formatearVentana } from '../../../shared/formato';

/** Aviso de mantenimiento programado: informa y deja claro que no hace falta ticket (HU-12). */
@Component({
  selector: 'app-maintenance-notice',
  templateUrl: './maintenance-notice.html',
  styleUrl: './maintenance-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceNotice {
  readonly estado = input.required<EstadoServicio>();

  protected readonly ventana = computed(() => {
    const ventana = this.estado().ventanaEstimada;
    return ventana ? formatearVentana(ventana) : null;
  });
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ErrorVista } from '../../../../application/state/conversacion.store';
import type { CodigoErrorBackend } from '../../../../domain/errors/error-backend';

const TITULOS: Readonly<Record<CodigoErrorBackend, string>> = {
  timeout: 'La respuesta tardó demasiado',
  'sin-conexion': 'Sin conexión con el servidor',
  'servicio-no-disponible': 'Servicio no disponible',
  interno: 'Error del servidor',
  validacion: 'La solicitud no es válida',
  'no-encontrado': 'No encontrado',
  conflicto: 'La operación ya no es posible',
  'limite-turnos': 'Límite de turnos alcanzado',
};

/** Error tipado dentro de la conversacion, con reintento cuando tiene sentido. */
@Component({
  selector: 'app-error-message',
  templateUrl: './error-message.html',
  styleUrl: './error-message.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorMessage {
  readonly error = input.required<ErrorVista>();
  readonly reintentar = output<void>();

  protected readonly titulo = computed(() => TITULOS[this.error().codigo]);
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SaludService } from '../../../nucleo/salud.service';

/**
 * Indicador compacto de la arquitectura que responde `/health`. El frontend la
 * descubre, no la configura (decision 7): sin backend levantado lo dice.
 */
@Component({
  selector: 'app-backend-status',
  templateUrl: './backend-status.html',
  styleUrl: './backend-status.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackendStatus {
  private readonly saludService = inject(SaludService);

  protected readonly backendUrl = this.saludService.backendUrl;
  protected readonly salud = this.saludService.salud;
  protected readonly error = this.saludService.error;
  protected readonly cargando = this.saludService.cargando;

  constructor() {
    this.saludService.consultar();
  }

  protected refrescar(): void {
    this.saludService.consultar();
  }
}

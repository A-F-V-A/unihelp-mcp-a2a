import { Component, computed, inject } from '@angular/core';
import { CATALOGO_ARQUITECTURAS, esIdentificadorArquitectura } from '@unihelp/dominio';
import { SaludService } from './nucleo/salud.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly saludService = inject(SaludService);

  protected readonly backendUrl = this.saludService.backendUrl;
  protected readonly salud = this.saludService.salud;
  protected readonly error = this.saludService.error;
  protected readonly cargando = this.saludService.cargando;

  /** Ficha del catalogo compartido, para mostrar el detalle de la arquitectura. */
  protected readonly descriptor = computed(() => {
    const arquitectura = this.salud()?.arquitectura;
    return esIdentificadorArquitectura(arquitectura) ? CATALOGO_ARQUITECTURAS[arquitectura] : null;
  });

  constructor() {
    this.saludService.consultar();
  }

  protected refrescar(): void {
    this.saludService.consultar();
  }
}

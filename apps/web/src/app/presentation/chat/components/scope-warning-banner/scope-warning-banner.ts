import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CanalAtencion } from '../../../../domain/models/conversacion';
import { ETIQUETA_CANAL } from '../../../shared/formato';

/**
 * Aviso dedicado para solicitudes fuera de alcance (HU-FE-11). Es deliberadamente
 * distinto de una burbuja: el solicitante debe notar que aqui no se resolvera.
 */
@Component({
  selector: 'app-scope-warning-banner',
  templateUrl: './scope-warning-banner.html',
  styleUrl: './scope-warning-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScopeWarningBanner {
  readonly motivo = input.required<string>();
  readonly canal = input.required<CanalAtencion>();

  protected readonly tipoCanal = computed(() => ETIQUETA_CANAL[this.canal().tipo]);

  /** Enlace accionable segun el tipo de canal, o `null` si el contacto no es navegable. */
  protected readonly enlace = computed(() => {
    const { tipo, contacto } = this.canal();
    switch (tipo) {
      case 'web':
        return contacto;
      case 'correo':
        return `mailto:${contacto}`;
      case 'telefono':
        return /^\+?[\d\s()-]{7,}$/.test(contacto) ? `tel:${contacto.replace(/\s/g, '')}` : null;
      case 'presencial':
        return null;
    }
  });
}

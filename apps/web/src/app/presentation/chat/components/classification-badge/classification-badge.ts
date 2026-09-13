import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TipoClasificacion } from '@unihelp/dominio';
import type { Clasificacion } from '../../../../domain/models/conversacion';

const ETIQUETAS: Readonly<Record<TipoClasificacion, { etiqueta: string; descripcion: string }>> = {
  informativa: {
    etiqueta: 'Informativa',
    descripcion: 'Entendí que buscas información sobre un trámite o una norma.',
  },
  diagnostico: {
    etiqueta: 'Diagnóstico',
    descripcion: 'Entendí que reportas algo que no funciona y hay que diagnosticarlo.',
  },
  compuesta: {
    etiqueta: 'Compuesta',
    descripcion: 'Entendí que tu solicitud mezcla una duda y un problema técnico.',
  },
  'fuera-de-alcance': {
    etiqueta: 'Fuera de alcance',
    descripcion: 'Entendí que tu solicitud no la atiende UniHelp.',
  },
};

/** Muestra como se entendio la solicitud, con icono y color propios por tipo (HU-FE-10). */
@Component({
  selector: 'app-classification-badge',
  templateUrl: './classification-badge.html',
  styleUrl: './classification-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassificationBadge {
  readonly clasificacion = input.required<Clasificacion>();

  protected readonly tipo = computed(() => this.clasificacion().tipo);
  protected readonly etiqueta = computed(() => ETIQUETAS[this.tipo()].etiqueta);
  protected readonly descripcion = computed(() => ETIQUETAS[this.tipo()].descripcion);
  protected readonly confianza = computed(
    () => `${Math.round(this.clasificacion().confianza * 100)} %`,
  );
}

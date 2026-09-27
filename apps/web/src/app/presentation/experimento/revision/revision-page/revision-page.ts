import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RevisionStore } from '../../../../application/state/revision.store';
import {
  type Desacuerdo,
  ROLES_REVISOR,
  type RolRevisor,
  type VeredictoRevision,
} from '../../../../domain/models/experimento/revision-humana';

type Vista = 'calificar' | 'adjudicar';

/** Resultado de una herramienta como JSON legible; un texto largo se deja tal cual. */
function legible(valor: unknown): string {
  return typeof valor === 'string' ? valor : JSON.stringify(valor, null, 2);
}

/**
 * Revision humana del juez (M7.4, M7.5; docs/04 capa 3; decision 56). Dos
 * personas califican a ciegas la misma muestra con la rubrica del juez, siempre
 * visible: marcan puntos clave y prohibiciones y el veredicto sale de la regla.
 * Nada en la pantalla delata arquitectura, modelo ni veredicto del juez.
 */
@Component({
  selector: 'app-revision-page',
  templateUrl: './revision-page.html',
  styleUrl: './revision-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevisionPage {
  protected readonly store = inject(RevisionStore);
  protected readonly roles = ROLES_REVISOR;
  protected readonly legible = legible;

  protected readonly vista = signal<Vista>('calificar');
  protected readonly nombre = signal('');
  protected readonly rolElegido = signal<RolRevisor>('A');
  /** Borradores de adjudicacion por item: veredicto elegido y motivo. */
  protected readonly borradores = signal<
    Readonly<Record<string, { veredicto: VeredictoRevision | null; motivo: string }>>
  >({});

  protected readonly porcentaje = computed(() => {
    const total = this.store.total();
    return total === 0 ? 0 : Math.round((this.store.calificadas() / total) * 100);
  });

  protected fijarNombre(evento: Event): void {
    this.nombre.set((evento.target as HTMLInputElement).value);
  }

  protected iniciar(): void {
    void this.store.iniciar(this.rolElegido(), this.nombre());
  }

  protected cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    if (vista === 'adjudicar') {
      void this.store.cargarAdjudicacion();
    }
  }

  protected fijarComentario(evento: Event): void {
    this.store.fijarComentario((evento.target as HTMLTextAreaElement).value);
  }

  protected guardar(): void {
    void this.store.guardarYSeguir().then((ok) => {
      if (ok) {
        document
          .querySelector('.revision__item')
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    });
  }

  protected marcado(lista: readonly number[], numero: number): boolean {
    return lista.includes(numero);
  }

  protected borrador(itemId: string): { veredicto: VeredictoRevision | null; motivo: string } {
    return this.borradores()[itemId] ?? { veredicto: null, motivo: '' };
  }

  protected elegirAdjudicado(itemId: string, veredicto: VeredictoRevision): void {
    this.borradores.update((b) => ({ ...b, [itemId]: { ...this.borrador(itemId), veredicto } }));
  }

  protected fijarMotivo(itemId: string, evento: Event): void {
    const motivo = (evento.target as HTMLTextAreaElement).value;
    this.borradores.update((b) => ({ ...b, [itemId]: { ...this.borrador(itemId), motivo } }));
  }

  protected adjudicar(desacuerdo: Desacuerdo): void {
    const b = this.borrador(desacuerdo.item.id);
    if (b.veredicto) {
      void this.store.adjudicar(desacuerdo.item.id, b.veredicto, b.motivo);
    }
  }
}

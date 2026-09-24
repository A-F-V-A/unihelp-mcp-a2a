import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ManifiestoSalidas } from '../../../../../domain/models/experimento/resultados-analisis';
import { huellaCorta } from '../../../shared/etiquetas-experimento';

/** Que muestra cada salida del cuaderno (analisis.ipynb, seccion 3). */
const DESCRIPCION: Readonly<Record<string, string>> = {
  figura_1: 'Tasa de éxito con IC 95 % por arquitectura y categoría (M1.1, M1.2).',
  figura_2: 'Descomposición de la latencia con la mediana de extremo a extremo (M4.2, M4.1).',
  figura_3: 'Repeticiones exitosas por tarea (M1.3, M1.4).',
  figura_4: 'Composición de los fallos por arquitectura (M1.5).',
  tabla_1: 'Piso de latencia por transporte (M4.3).',
  tabla_2: 'Efectividad por arquitectura y categoría con IC 95 % (M1.1, M1.2).',
  tabla_4: 'Costo por arquitectura (M4.1, M4.4 a M4.7).',
  tabla_7: 'Fiabilidad del experimento: observado, umbral y consecuencia (M7).',
};

/**
 * Figuras SVG y tablas CSV que publico el cuaderno, con su SHA-256 del
 * manifiesto. Se sirven tal cual desde `salidas/`: son las mismas que van al
 * manuscrito (HU-MET-04), no una version del panel.
 */
@Component({
  selector: 'app-figures-gallery',
  templateUrl: './figures-gallery.html',
  styleUrl: './figures-gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiguresGallery {
  readonly manifiesto = input.required<ManifiestoSalidas>();
  readonly urlDe = input.required<(archivo: string) => string>();

  protected readonly huellaCorta = huellaCorta;

  protected readonly figuras = computed(() =>
    this.manifiesto().salidas.filter((s) => s.tipo === 'figura'),
  );
  protected readonly tablas = computed(() =>
    this.manifiesto().salidas.filter((s) => s.tipo === 'tabla'),
  );

  protected descripcionDe(etiqueta: string): string {
    return DESCRIPCION[etiqueta] ?? '';
  }
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Pestañas del panel, en el orden en que se leen: primero la credibilidad, despues el detalle. */
const SECCIONES = [
  { ruta: 'resultados', etiqueta: 'Resultados' },
  { ruta: 'corridas', etiqueta: 'Corridas' },
  { ruta: 'tareas', etiqueta: 'Tareas' },
  { ruta: 'preparar', etiqueta: 'Correr una corrida' },
] as const;

/**
 * Marco del panel del experimento: cabecera con vuelta al chat, pestañas y la
 * advertencia permanente de que es de solo lectura (HU-MET-14). El contenido
 * de cada pestaña llega por el router.
 */
@Component({
  selector: 'app-experimento-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './experimento-shell.html',
  styleUrl: './experimento-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentoShell {
  protected readonly secciones = SECCIONES;
}

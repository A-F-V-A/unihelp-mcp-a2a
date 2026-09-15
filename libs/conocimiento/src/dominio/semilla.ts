/**
 * Forma del archivo de datos semilla (`libs/conocimiento/seeds/`). Es la forma
 * en que una persona escribe el corpus: anidada y sin posiciones. Las posiciones
 * de los extractos, las aristas y los estados de cada variante se derivan con
 * `construirEstadoConocimiento`.
 */
import type { NivelEstadoServicio } from '@unihelp/dominio';
import type { Categoria } from './categoria';
import type { VentanaEstimada } from './componente';
import type { AlcanceAfectacion } from './estado-servicio';
import type { CorpusConocimiento } from './grafo';
import type { Politica } from './politica';
import type { Servicio } from './servicio';

export interface SemillaServicio extends Servicio {
  /** Codigos de los componentes del servicio (aristas servicio -> componente). */
  readonly componentes: readonly string[];
}

/** En la semilla un componente no trae estado: lo fija el estado inicial elegido. */
export interface SemillaComponente {
  readonly codigo: string;
  readonly nombre: string;
}

/** Afectacion de un servicio dentro de un estado inicial (docs/10, seccion 4). */
export interface SemillaAfectacion {
  readonly servicio: string;
  readonly estado: Exclude<NivelEstadoServicio, 'operativo'>;
  readonly alcance: AlcanceAfectacion;
  readonly componentesAfectados: readonly string[];
  readonly mensaje: string;
  readonly ventanaEstimada: VentanaEstimada | null;
  readonly incidenteRef: string;
  readonly desde: string;
}

/** Variante del entorno con la que arranca una tarea. Sin afectaciones = todo operativo. */
export interface SemillaEstadoInicial {
  readonly codigo: string;
  readonly descripcion: string;
  readonly afectaciones: readonly SemillaAfectacion[];
}

export interface SemillaVersionPolitica {
  readonly version: string;
  readonly titulo: string;
  readonly vigenteDesde: string;
  readonly vigente: boolean;
  /** Numerales en orden; cada uno se vuelve un `Extracto` con su posicion. */
  readonly extractos: readonly string[];
}

export interface SemillaPolitica extends Politica {
  readonly categorias: readonly string[];
  readonly servicios: readonly string[];
  readonly versiones: readonly SemillaVersionPolitica[];
}

export interface SemillaConocimiento {
  /** Cambia cada vez que cambia el contenido. Ej.: `2026.09.14-2`. */
  readonly versionSemilla: string;
  /** Instante de los servicios y componentes que no estan afectados. */
  readonly instanteBase: string;
  /** Aclaraciones para personas: que datos son sinteticos y por que. No entran a la base. */
  readonly notas: readonly string[];
  readonly servicios: readonly SemillaServicio[];
  readonly componentes: readonly SemillaComponente[];
  readonly estadosIniciales: readonly SemillaEstadoInicial[];
  readonly categorias: readonly Categoria[];
  readonly politicas: readonly SemillaPolitica[];
}

/** Variante a construir. Por defecto `todo_operativo` con corpus `estandar`. */
export interface SeleccionEstado {
  readonly estadoInicial: string;
  readonly corpus: CorpusConocimiento;
}

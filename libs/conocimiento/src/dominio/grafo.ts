/**
 * El grafo de conocimiento completo: nodos, aristas y las vistas que se leen al
 * recorrerlo (HU-09, HU-10). Se modela con tablas de nodos y de aristas en
 * PostgreSQL, no con un motor de grafos (decision 16).
 */
import type { Categoria } from './categoria';
import type { Componente } from './componente';
import type { EstadoServicio } from './estado-servicio';
import type { Extracto, Politica, VersionPolitica } from './politica';
import type { Servicio } from './servicio';

/** Arista servicio -> componente. */
export interface AristaServicioComponente {
  readonly servicioCodigo: string;
  readonly componenteCodigo: string;
}

/** Arista politica -> categoria. */
export interface AristaPoliticaCategoria {
  readonly politicaCodigo: string;
  readonly categoriaCodigo: string;
}

/** Arista politica -> servicio al que aplica. */
export interface AristaPoliticaServicio {
  readonly politicaCodigo: string;
  readonly servicioCodigo: string;
}

/**
 * Corpus de politicas. `estandar` excluye las adversariales; `adversarial` las
 * incluye y solo se usa en las tareas de esa categoria (docs/01, 4.3).
 */
export const CORPUS_CONOCIMIENTO = ['estandar', 'adversarial'] as const;

export type CorpusConocimiento = (typeof CORPUS_CONOCIMIENTO)[number];

/** Estado inicial por defecto: los cuatro servicios operativos (docs/10, seccion 4). */
export const ESTADO_INICIAL_BASE = 'todo_operativo';

/** Que variante de la semilla esta cargada. Entra en la huella: dos variantes nunca comparten huella. */
export interface EntornoConocimiento {
  readonly versionSemilla: string;
  /** Codigo de docs/10, seccion 4. Ej.: `av_degradado_carga`. */
  readonly estadoInicial: string;
  readonly corpus: CorpusConocimiento;
}

/** Tablas de la base de conocimiento, en el orden en que se insertan. */
export const TABLAS_CONOCIMIENTO = [
  'servicios',
  'estados_servicio',
  'componentes',
  'categorias',
  'politicas',
  'versiones_politica',
  'extractos',
  'servicio_componente',
  'politica_categoria',
  'politica_servicio',
  'entorno',
] as const;

export type TablaConocimiento = (typeof TABLAS_CONOCIMIENTO)[number];

/** Numero de filas por tabla: permite detectar contaminacion a simple vista (HU-24). */
export type ConteosConocimiento = Readonly<Record<TablaConocimiento, number>>;

/**
 * Contenido completo de la base de conocimiento. Es lo que se escribe al
 * restablecer y lo que se serializa para calcular la huella (HU-36).
 */
export interface EstadoConocimiento {
  readonly servicios: readonly Servicio[];
  readonly estadosServicio: readonly EstadoServicio[];
  readonly componentes: readonly Componente[];
  readonly categorias: readonly Categoria[];
  readonly politicas: readonly Politica[];
  readonly versiones: readonly VersionPolitica[];
  readonly extractos: readonly Extracto[];
  readonly serviciosComponentes: readonly AristaServicioComponente[];
  readonly politicasCategorias: readonly AristaPoliticaCategoria[];
  readonly politicasServicios: readonly AristaPoliticaServicio[];
  readonly entorno: EntornoConocimiento;
}

/** Resultado de recorrer servicio -> componentes (HU-09, HU-10). */
export interface ComponentesDeServicio {
  readonly servicio: Servicio;
  readonly estado: EstadoServicio;
  /** Ordenados por codigo (orden binario, no alfabetico del idioma). */
  readonly componentes: readonly Componente[];
}

/** Version vigente de una politica, sin su contenido. */
export interface PoliticaVigente {
  readonly codigo: string;
  readonly version: string;
  readonly titulo: string;
  readonly alcance: string;
}

/** Resultado de recorrer categoria -> politicas (HU-09, HU-10). */
export interface PoliticasDeCategoria {
  readonly categoria: Categoria;
  /** Ordenadas por codigo (orden binario). */
  readonly politicas: readonly PoliticaVigente[];
}

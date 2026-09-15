import type { PoliticaEncontrada } from '../busqueda';
import type { ComponentesDeServicio, EstadoConocimiento, PoliticasDeCategoria } from '../grafo';

/** Busqueda ya normalizada, con el umbral y el limite resueltos por el caso de uso. */
export interface CriterioBusquedaPoliticas {
  readonly texto: string;
  readonly servicio: string | null;
  readonly categoria: string | null;
  readonly umbral: number;
  readonly limite: number;
}

/** Lo que devuelve la base antes de interpretar la ausencia de resultados. */
export interface CandidatosBusqueda {
  readonly consultaNormalizada: string;
  /** Lexemas distintos de la consulta tras normalizar. */
  readonly terminos: number;
  /** Politicas vigentes que comparten al menos un termino, sin aplicar el umbral. */
  readonly coincidencias: number;
  /** Solo las que alcanzan el umbral, ya ordenadas y recortadas al limite. */
  readonly politicas: readonly PoliticaEncontrada[];
}

export interface SiembraRepositorio {
  readonly accion: 'sembrada' | 'sin-cambios';
  readonly estado: EstadoConocimiento;
}

/** Puerto de la base de conocimiento. La unica implementacion es PostgreSQL (decision 16). */
export interface ConocimientoRepository {
  /**
   * Busca entre las versiones VIGENTES. Garantiza orden por relevancia
   * descendente y desempate por codigo ascendente en orden binario, y que
   * todas las politicas devueltas alcanzan `criterio.umbral`. No decide que
   * significa no encontrar nada: eso es del caso de uso.
   */
  buscarPoliticasVigentes(criterio: CriterioBusquedaPoliticas): Promise<CandidatosBusqueda>;

  /** `null` si el servicio no existe. Componentes ordenados por codigo. */
  obtenerComponentesDeServicio(servicioCodigo: string): Promise<ComponentesDeServicio | null>;

  /** `null` si la categoria no existe. Politicas vigentes ordenadas por codigo. */
  obtenerPoliticasDeCategoria(categoriaCodigo: string): Promise<PoliticasDeCategoria | null>;

  /**
   * Siembra solo si TODAS las tablas estan vacias. Si ya hay datos y son
   * identicos a `estado`, no escribe nada. Si difieren, lanza
   * `EstadoInconsistenteError` sin tocar la base. Nunca borra.
   */
  sembrarSiVacia(estado: EstadoConocimiento): Promise<SiembraRepositorio>;

  /**
   * Borra todo y escribe `estado` en UNA transaccion. Devuelve el estado leido
   * dentro de esa misma transaccion; si no es identico al pedido, revierte y
   * lanza `EstadoInconsistenteError`. No verifica el perfil: eso es del caso de uso.
   */
  restablecer(estado: EstadoConocimiento): Promise<EstadoConocimiento>;

  /** Lee el contenido completo de la base. */
  leerEstado(): Promise<EstadoConocimiento>;
}

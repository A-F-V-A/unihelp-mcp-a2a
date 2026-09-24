/**
 * Contrato del SIMULADOR DE SISTEMAS UNIVERSITARIOS (`apps/simulador-servicios`).
 *
 * En el caso de uso real, UniHelp consultaria el estado de cuatro sistemas
 * distintos (aula virtual, correo institucional, autenticacion y matricula),
 * cada uno operado por su dependencia y con su propio endpoint de salud. Aqui
 * no existen: los emula un solo backend, que publica el estado que la tarea en
 * curso declara en `estado_inicial.servicios` (`docs/tasks/*.yaml`).
 *
 * El simulador NO es una fuente de datos paralela: la unica fuente sigue siendo
 * `libs/conocimiento` sobre PostgreSQL, la misma que leen los agentes. El
 * simulador solo la publica por HTTP y permite conmutar el estado inicial
 * (decision 33). Por eso la huella de HU-36 sigue cubriendo todo lo que el
 * simulador muestra.
 *
 * Las rutas viven **fuera del prefijo `/api`**, igual que `/health` y
 * `/experimento/*` (decisiones 6 y 32): `/api` es el contrato que atiende el
 * frontend de triaje y ninguna de estas rutas forma parte de el.
 */

import type {
  AlcanceAfectacion,
  AreaServicio,
  EstadoServicioPublicado,
  NivelServicio,
} from '@unihelp/dominio';
import type { CorpusConocimientoDto } from './experimento.contrato';
import type { VentanaEstimadaDto } from './servicio.contrato';

export const RUTAS_SIMULACION = {
  /** `GET` -> {@link SaludSistemasDto}. Los cuatro sistemas de una sola vez. */
  salud: '/simulacion/salud',
  /** `GET` -> {@link SistemaEmuladoDto}[]. Catalogo, sin estado. */
  sistemas: '/simulacion/sistemas',
  /** `GET` -> {@link SaludSistemaDto}. Un sistema por su codigo (`aula_virtual`). */
  sistema: (codigo: string) => `/simulacion/sistemas/${encodeURIComponent(codigo)}/salud`,
  /** `GET` -> {@link EstadoInicialVigenteDto}. Que variante esta cargada ahora. */
  estadoInicial: '/simulacion/estado-inicial',
  /** `GET` -> {@link EstadoInicialDisponibleDto}[]. Los estados iniciales de la semilla. */
  estadosIniciales: '/simulacion/estados-iniciales',
  /** `POST` {@link ConmutarEstadoInicialDto} -> {@link EstadoInicialVigenteDto}. Solo perfil experimento. */
  conmutar: '/simulacion/estado-inicial',
} as const;

/**
 * Ruta propia de un sistema emulado: `aula_virtual` -> `/simulacion/aula-virtual/salud`.
 *
 * Existe ademas de {@link RUTAS_SIMULACION.sistema} porque cada sistema emulado
 * tiene su propio controlador, como lo tendria si fuera un servicio de verdad:
 * asi el simulador se lee como cuatro sistemas y no como un catalogo.
 */
export function rutaPropiaDeSistema(codigo: string): string {
  return `/simulacion/${codigo.replaceAll('_', '-')}/salud`;
}

/** Ficha de un sistema emulado, sin su estado. */
export interface SistemaEmuladoDto {
  /** Codigo del servicio en la base de conocimiento. Ej.: `aula_virtual`. */
  readonly codigo: string;
  readonly nombre: string;
  readonly area: AreaServicio;
  readonly unidadResponsable: string;
  readonly nivelServicio: NivelServicio;
  /** Ruta propia de este sistema. Ver {@link rutaPropiaDeSistema}. */
  readonly ruta: string;
}

/** Estado de un componente dentro de un sistema emulado. */
export interface ComponenteEmuladoDto {
  readonly codigo: string;
  readonly nombre: string;
  readonly estado: EstadoServicioPublicado;
  readonly ventanaEstimada: VentanaEstimadaDto | null;
  readonly incidenteRef: string | null;
  /** ISO 8601 UTC. */
  readonly actualizadoEn: string;
}

/**
 * Bloque de estado de un sistema, con los nombres y el vocabulario de
 * `estado_inicial.servicios` de las tareas (`estado`, `alcance`,
 * `componentes_afectados`) y no con la convencion camelCase del repositorio:
 * el punto de este endpoint es poder comparar la respuesta con el YAML de la
 * tarea sin traducir nada (mismo criterio que `TrazaParcialDto`, decision 22).
 *
 * Es un superconjunto del YAML: agrega el comunicado, la ventana publicada y la
 * referencia del incidente, que la tarea no declara pero el sistema si publica.
 */
export interface EstadoSistemaEmuladoDto {
  readonly estado: EstadoServicioPublicado;
  /** `null` cuando el sistema esta operativo. */
  readonly alcance: AlcanceAfectacion | null;
  /** Codigos de los componentes que no estan operativos. Vacio si no hay afectacion. */
  readonly componentes_afectados: readonly string[];
  /**
   * Comunicado publicado por el sistema. Es CONTENIDO RECUPERADO: puede traer
   * texto que aparenta ser una instruccion (T-ADV-007) y quien lo consuma nunca
   * debe tratarlo como una orden. El simulador lo entrega tal cual, sin sanear,
   * porque sanearlo aqui borraria justamente lo que la tarea adversarial mide.
   */
  readonly mensaje: string | null;
  /** `null` si el sistema no publico ventana: nunca se estima (HU-10). */
  readonly ventana_estimada: VentanaEstimadaDto | null;
  readonly incidente_ref: string | null;
  /** Inicio del estado actual. ISO 8601 UTC. */
  readonly desde: string;
}

/** `GET /simulacion/sistemas/:codigo/salud` y la ruta propia de cada sistema. */
export interface SaludSistemaDto {
  readonly sistema: SistemaEmuladoDto;
  readonly estado: EstadoSistemaEmuladoDto;
  /** Todos los componentes del sistema, ordenados por codigo (RM-10). */
  readonly componentes: readonly ComponenteEmuladoDto[];
  /** Instante de la respuesta, ISO 8601. No entra en la huella. */
  readonly consultadoEn: string;
}

/**
 * `GET /simulacion/salud`: el mapa completo, con la misma forma del bloque
 * `estado_inicial.servicios` de una tarea. Comparar este `servicios` con el del
 * YAML es la verificacion de que el entorno quedo como la tarea pide.
 */
export interface SaludSistemasDto {
  /** Codigo del estado inicial cargado. Ej.: `av_degradado_carga`. */
  readonly estadoInicial: string;
  readonly corpus: CorpusConocimientoDto;
  readonly versionSemilla: string;
  /** Indexado por codigo de sistema, en orden binario de codigo (RM-10). */
  readonly servicios: Readonly<Record<string, EstadoSistemaEmuladoDto>>;
  readonly consultadoEn: string;
}

/** Una variante disponible en la semilla: `GET /simulacion/estados-iniciales`. */
export interface EstadoInicialDisponibleDto {
  readonly codigo: string;
  readonly descripcion: string;
  /** Codigos de los sistemas que esta variante deja afectados. Vacio en `todo_operativo`. */
  readonly serviciosAfectados: readonly string[];
}

/** `POST /simulacion/estado-inicial`. */
export interface ConmutarEstadoInicialDto {
  /** Codigo del estado inicial (`estado_inicial.overlay` del YAML). */
  readonly estadoInicial: string;
  /** Por defecto `estandar`. Las tareas adversariales usan `adversarial`. */
  readonly corpus?: CorpusConocimientoDto;
}

/** `GET`/`POST /simulacion/estado-inicial`: que hay cargado y con que huella. */
export interface EstadoInicialVigenteDto {
  readonly estadoInicial: string;
  readonly corpus: CorpusConocimientoDto;
  readonly versionSemilla: string;
  /**
   * `sha256:<64 hex>` del estado completo de la base de conocimiento, o `null`
   * en una lectura: la huella solo se calcula al escribir, dentro de la misma
   * transaccion que restablece (HU-36).
   */
  readonly huella: string | null;
  /** Filas por tabla tras conmutar; `null` en una lectura. */
  readonly conteos: Readonly<Record<string, number>> | null;
}

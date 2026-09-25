import type { A2aTaskDto, HabilidadA2a } from '@unihelp/contratos';

/** Lo que el orquestador delega: la habilidad, los argumentos del modelo y el contexto de la ejecucion. */
export interface SolicitudDelegacion {
  readonly habilidad: HabilidadA2a;
  readonly entrada: Readonly<Record<string, unknown>>;
  readonly traceId: string;
  readonly conversacionId: string;
  readonly tiempoRestanteMs: number | null;
}

/**
 * Lo que vuelve de una delegacion visto desde el EMISOR: la tarea del receptor
 * tal como viajo (con su artefacto y su medicion en `metadata`) y la ida y
 * vuelta medida por quien delego. `transport_ms = rttMs - duracion_ms` del
 * receptor (D5, RM-05).
 */
export interface ResultadoDelegacion {
  readonly tarea: A2aTaskDto;
  readonly rttMs: number;
  /** Reloj de pared, solo para ordenar (D6). */
  readonly tEmision: string;
  readonly tRecepcion: string;
}

/**
 * Puerto de especialistas del orquestador (decision 44). Es la UNICA frontera
 * entre el nucleo multiagente compartido y la variable que H3 mide: en B2 lo
 * cumple una clase que invoca a los especialistas en el mismo proceso; en B3,
 * un cliente A2A que los alcanza por red. El orquestador no conoce ninguna
 * implementacion concreta.
 *
 * `delegar` nunca lanza porque el especialista no pudo completar (eso vuelve
 * como tarea `failed`); SI lanza `ErrorInfraestructura` cuando el especialista
 * no responde o responde que su infraestructura fallo, para que la ejecucion
 * termine como `error_infraestructura` y nunca con un diagnostico inventado
 * (RM-15; docs/03, 7, degradacion).
 */
export interface PuertoEspecialistas {
  delegar(solicitud: SolicitudDelegacion): Promise<ResultadoDelegacion>;
}

export const PUERTO_ESPECIALISTAS = Symbol('PUERTO_ESPECIALISTAS');

/**
 * Contrato de la CONSOLA DEL EXPERIMENTO (`apps/consola-experimento`): el
 * proceso local que lanza el ejecutor y el cuaderno de analisis desde el panel
 * web y transmite su progreso (decision 39).
 *
 * La consola NO calcula ninguna metrica ni modifica trazas o resultados ya
 * escritos (RM-02): solo arranca, uno a la vez (RM-04), los mismos comandos
 * que se correrian en una terminal (`uv run python -m ejecutor correr ...` y
 * `uv run papermill ...`) y reenvia sus lineas de salida. Una corrida lanzada
 * desde aqui es identica a una lanzada por linea de comandos: misma
 * configuracion, mismo `config_hash`, mismos artefactos.
 *
 * Las rutas viven fuera del prefijo `/api` (decisiones 6 y 32): no forman
 * parte del contrato de triaje que atiende el frontend contra B0-B3.
 */

import type { IdentificadorArquitectura } from '@unihelp/dominio';

export const RUTAS_CONSOLA = {
  /** `GET` -> {@link EstadoConsolaDto}. Que trabajo corre ahora, si alguno. */
  estado: '/consola/estado',
  /** `POST` {@link LanzarCorridaDto} -> {@link TrabajoDto}. 409 si ya hay uno en marcha. */
  corridas: '/consola/corridas',
  /** `POST` {@link LanzarAnalisisDto} -> {@link TrabajoDto}. 409 si ya hay uno en marcha. */
  analisis: '/consola/analisis',
  /** `GET` (text/event-stream) -> eventos {@link EventoTrabajoDto} del trabajo indicado. */
  eventos: (trabajoId: string) => `/consola/trabajos/${encodeURIComponent(trabajoId)}/eventos`,
  /** `GET` -> {@link TrabajoDto} con todas sus lineas hasta ahora. */
  trabajo: (trabajoId: string) => `/consola/trabajos/${encodeURIComponent(trabajoId)}`,
  /** `POST` -> {@link TrabajoDto}. Interrumpe el trabajo en marcha (SIGTERM). */
  cancelar: (trabajoId: string) => `/consola/trabajos/${encodeURIComponent(trabajoId)}/cancelar`,
} as const;

export const TIPOS_TRABAJO_CONSOLA = ['corrida', 'analisis'] as const;

export type TipoTrabajoConsola = (typeof TIPOS_TRABAJO_CONSOLA)[number];

export const ESTADOS_TRABAJO_CONSOLA = ['en_marcha', 'terminado', 'fallido', 'cancelado'] as const;

export type EstadoTrabajoConsola = (typeof ESTADOS_TRABAJO_CONSOLA)[number];

export const MODOS_LLM_CONSOLA = ['live', 'record', 'replay'] as const;

export type ModoLlmConsola = (typeof MODOS_LLM_CONSOLA)[number];

/**
 * Lo que se le pide al ejecutor. Son exactamente las opciones de
 * `experiment/ejecutor/cli.py correr`; lo que se omite lo decide `corrida.yaml`.
 */
export interface LanzarCorridaDto {
  readonly arquitecturas: readonly IdentificadorArquitectura[];
  /** Ids o comodines (`T-ADV-*`); `null` = las 40 tareas. */
  readonly tareas: readonly string[] | null;
  readonly repeticiones: number | null;
  readonly modoLlm: ModoLlmConsola | null;
  /** Directorio de la corrida en `experiment/corridas`; `null` = marca de tiempo. */
  readonly nombre: string | null;
}

/** Corre el cuaderno sobre una corrida ya escrita y reescribe `salidas/`. */
export interface LanzarAnalisisDto {
  /** Nombre del directorio en `experiment/corridas`. */
  readonly corrida: string;
}

export interface TrabajoDto {
  readonly id: string;
  readonly tipo: TipoTrabajoConsola;
  readonly estado: EstadoTrabajoConsola;
  /** Linea de comandos tal como se ejecuto, para copiarla o reproducirla. */
  readonly comando: string;
  /** Nombre de la corrida afectada (la lanzada, o la analizada). */
  readonly corrida: string | null;
  /** ISO 8601. */
  readonly iniciadoEn: string;
  readonly terminadoEn: string | null;
  /** Codigo de salida del proceso; `null` mientras corre o si se cancelo antes de terminar. */
  readonly codigoSalida: number | null;
  /** Salida acumulada, una entrada por linea, en orden. */
  readonly lineas: readonly LineaTrabajoDto[];
}

export interface LineaTrabajoDto {
  readonly numero: number;
  readonly origen: 'stdout' | 'stderr';
  readonly texto: string;
  /** ISO 8601 de cuando la consola la recibio. */
  readonly en: string;
}

export interface EstadoConsolaDto {
  /** Trabajo en marcha, o el ultimo terminado si no hay ninguno corriendo. */
  readonly trabajo: TrabajoDto | null;
  /** Nombre del script de Python y de `uv` que la consola invoca, para diagnostico. */
  readonly ejecutable: string;
  /** Directorio `experiment/` absoluto sobre el que trabaja. */
  readonly directorioExperimento: string;
}

/** Evento del flujo SSE: una linea nueva o el cierre del trabajo. */
export type EventoTrabajoDto =
  | { readonly tipo: 'linea'; readonly linea: LineaTrabajoDto }
  | { readonly tipo: 'fin'; readonly trabajo: TrabajoDto };

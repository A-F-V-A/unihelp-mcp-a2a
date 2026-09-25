/**
 * Rutas que consume el EJECUTOR del experimento, no el frontend.
 *
 * Viven **fuera del prefijo `/api`**, igual que `/health` (decision 6), porque
 * `/api` es el contrato que atiende la interfaz y estas rutas no forman parte de
 * el: ningun componente de `apps/web` las llama.
 *
 * Estan aqui y no dentro de `apps/b0-directo` por la regla de oro del
 * experimento: si cada arquitectura definiera su propia forma de restablecer el
 * entorno o de entregar su traza, el ejecutor tendria cuatro clientes distintos
 * y una diferencia de medicion podria venir del ejecutor y no del protocolo.
 * Las cuatro arquitecturas responden exactamente esto (decision 32).
 *
 * Solo existen con `UNIHELP_PERFIL=experimento`: fuera de ese perfil el backend
 * ni siquiera registra el controlador y las rutas devuelven 404.
 */

import type { EstadoTareaA2a, HabilidadA2a } from './a2a.contrato';

export const RUTAS_EXPERIMENTO = {
  /** `POST` {@link RestablecerEntornoDto} -> {@link EntornoRestablecidoDto}. Borra y repuebla. */
  restablecer: '/experimento/restablecer',
  /** `GET` -> {@link TrazaParcialDto}: lo que solo el backend sabe de una ejecucion. */
  traza: (traceId: string) => `/experimento/trazas/${encodeURIComponent(traceId)}`,
} as const;

/** Corpus de politicas de la semilla. El `adversarial` agrega las tres envenenadas. */
export const CORPUS_CONOCIMIENTO = ['estandar', 'adversarial'] as const;

export type CorpusConocimientoDto = (typeof CORPUS_CONOCIMIENTO)[number];

/** `POST /experimento/restablecer`. */
export interface RestablecerEntornoDto {
  /** Codigo del estado inicial de la tarea (`estado_inicial.overlay` del YAML). */
  readonly estadoInicial: string;
  readonly corpus: CorpusConocimientoDto;
}

/** Respuesta del restablecimiento: la huella es la que va a `provenance.state_hash_inicial`. */
export interface EntornoRestablecidoDto {
  /** `sha256:<64 hex>`. Si no coincide con la esperada, el ejecutor aborta (HU-36, M7.2). */
  readonly huella: string;
  readonly versionSemilla: string;
  readonly estadoInicial: string;
  readonly corpus: CorpusConocimientoDto;
  readonly conteos: Readonly<Record<string, number>>;
  /** Tablas del registro de tickets que quedaron vacias (decision 31). */
  readonly ticketsVaciados: readonly string[];
  /** Siempre `false`: la auditoria es de solo agregar y nunca se restablece (HU-35). */
  readonly auditoriaVaciada: false;
}

/** Una llamada a herramienta, con los nombres de campo de `traza.schema.json`. */
export interface LlamadaHerramientaDto {
  readonly seq: number;
  readonly nombre: string;
  /** Exactamente lo que emitio el modelo, antes de validar (M2.3). */
  readonly args: Readonly<Record<string, unknown>>;
  readonly isError: boolean;
  readonly resultado_status: string;
  /** Sin sanear: la fidelidad de citacion busca aqui las cifras citadas (M3.1). */
  readonly resultado: unknown;
  readonly latency_ms: number;
  readonly agente: string;
  readonly transporte: string;
}

/** Una transicion del ciclo de vida de la tarea del orquestador (docs/03, 3); `t` solo ordena (D6). */
export interface EstadoTareaA2aDto {
  readonly estado: EstadoTareaA2a;
  readonly t: string;
}

/**
 * Un salto entre agentes, con los nombres de `a2a.hops[]` de `docs/05`. El
 * `transport_ms` es `rtt_ms - procesamiento_receptor_ms`: el receptor reporta su
 * duracion y el emisor mide la ida y vuelta, nunca se restan marcas de tiempo
 * de procesos distintos (D5, RM-05). En B2 el salto ocurre en proceso y el
 * transporte es casi cero, pero se mide igual (M4.2).
 */
export interface SaltoA2aDto {
  /** Posicion del salto en la ejecucion, desde 1. */
  readonly n: number;
  readonly de: string;
  readonly a: string;
  readonly habilidad: HabilidadA2a;
  /** Identificador de la tarea que abrio el receptor. */
  readonly task_id: string;
  readonly estado: EstadoTareaA2a;
  readonly t_emision: string;
  readonly t_recepcion: string;
  readonly rtt_ms: number;
  readonly procesamiento_receptor_ms: number;
  readonly transport_ms: number;
}

/**
 * `a2a` de la traza (`$defs/mensajeriaAgentes`). En B0 y B1 es
 * `{ mensajes_totales: 0 }`: un solo agente, sin mensajes entre agentes por
 * definicion (M4.5). En B2 y B3 cada delegacion cuenta dos mensajes (la
 * solicitud y la respuesta), en proceso o por red, para que M4.5 compare lo
 * mismo en ambas (decision 44).
 */
export interface MensajeriaAgentesDto {
  readonly mensajes_totales: number;
  readonly task_id?: string;
  readonly estados?: readonly EstadoTareaA2aDto[];
  readonly hops?: readonly SaltoA2aDto[];
  readonly artefactos?: readonly string[];
}

/** Evento de auditoria del servidor, tal como lo pide `server_audit[]` de la traza. */
export interface EventoAuditoriaDto {
  readonly accion: string;
  readonly resultado: string;
  readonly actor: string;
  readonly recurso: string;
  readonly motivo: string | null;
  readonly tokenValido: boolean | null;
  readonly payloadHash: string;
}

/**
 * `GET /experimento/trazas/:traceId`: la parte de la traza que **solo el backend
 * conoce**. El ejecutor completa el resto (identidad de la tarea, repeticion,
 * conversacion, huella del estado) y arma la `TrazaEjecucion` final.
 *
 * Los nombres siguen `experiment/schemas/traza.schema.json` y no la convencion
 * en español del repositorio: son los del registro de metricas y renombrarlos
 * obligaria a traducirlos dos veces (RM-08, decision 22).
 */
export interface TrazaParcialDto {
  readonly trace_id: string;
  readonly timing: {
    readonly total_ms: number;
    readonly breakdown: {
      readonly llm_ms: number;
      readonly tool_exec_ms: number;
      readonly transport_ms: number;
      /** Residuo SIN corregir: uno negativo invalida la ejecucion (HU-MET-07). */
      readonly orchestration_ms: number;
    };
  };
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cached_input_tokens: number;
    readonly llm_calls: number;
  };
  readonly model: {
    readonly provider: string;
    readonly id: string;
    readonly temperature: number;
    readonly top_p: number;
    readonly max_tokens: number;
  };
  /**
   * Como termino cada turno del agente, en orden: `respuesta`, `timeout`,
   * `limite_herramientas` o `error_agente`. El ejecutor lo traduce a
   * `outcome.status` en vez de deducirlo del texto del aviso de corte.
   */
  readonly terminaciones: readonly string[];
  /**
   * `resultado_triaje` del ultimo turno que lo emitio (HU-30), o `null`. Es el
   * `final_json` de la traza y el artefacto que la compuerta automatica usa para
   * las politicas citadas y la clasificacion (docs/04, seccion 4).
   */
  readonly final_json: Readonly<Record<string, unknown>> | null;
  /** Las de TODOS los agentes de la ejecucion, en orden de emision; `agente` dice quien la hizo. */
  readonly tool_calls: readonly LlamadaHerramientaDto[];
  /** Mensajeria entre agentes; el ejecutor la copia tal cual a `a2a` de la traza. */
  readonly a2a: MensajeriaAgentesDto;
  readonly server_audit: readonly EventoAuditoriaDto[];
  /** Numeros de ticket creados en esta ejecucion, segun el registro (no segun el agente). */
  readonly tickets_creados: readonly string[];
}

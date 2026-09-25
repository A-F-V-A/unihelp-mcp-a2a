/**
 * Contratos de red para el protocolo Agent2Agent (A2A v1.0) en la condicion B3.
 *
 * Define la estructura de las Agent Cards publicadas por cada agente en
 * `/.well-known/agent-card.json`, el ciclo de vida de las tareas A2A, los
 * mensajes JSON-RPC 2.0 y los artefactos fuertemente tipados intercambiados
 * entre el orquestador y los especialistas (HU-29, HU-30, RNF-04, doc 03).
 */

import type { LlamadaHerramientaDto } from './experimento.contrato';

/**
 * Ruta estandar donde cada agente expone su Agent Card para el descubrimiento (HU-29).
 */
export const RUTA_AGENT_CARD = '/.well-known/agent-card.json';

/**
 * Ruta base donde cada agente A2A atiende peticiones JSON-RPC 2.0 y SSE del protocolo (doc 03 §1).
 */
export const RUTA_A2A = '/a2a';

/** Habilidad o skill declarada en la Agent Card de un agente A2A (HU-29). */
export interface AgentSkillDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly examples: readonly string[];
  readonly inputModes?: readonly string[];
  readonly outputModes?: readonly string[];
}

/** Proveedor o institucion responsable del agente. */
export interface AgentProviderDto {
  readonly organization: string;
  readonly url: string;
}

/** Capacidades del agente respecto a streaming y notificaciones. */
export interface AgentCapabilitiesDto {
  readonly streaming: boolean;
  readonly pushNotifications: boolean;
  readonly stateTransitionHistory: boolean;
}

/**
 * Tarjeta de presentacion (Agent Card) de un agente segun especificacion A2A v1.0 (HU-29).
 * Se sirve en `GET /.well-known/agent-card.json`.
 */
export interface AgentCardDto {
  readonly protocolVersion: string;
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly preferredTransport: 'JSONRPC' | 'HTTP+SSE';
  readonly version: string;
  readonly provider?: AgentProviderDto;
  readonly capabilities: AgentCapabilitiesDto;
  readonly defaultInputModes: readonly string[];
  readonly defaultOutputModes: readonly string[];
  readonly skills: readonly AgentSkillDto[];
}

/** Estados formales del ciclo de vida de una tarea A2A (HU-30, doc 03 §3). */
export const ESTADOS_TAREA_A2A = [
  'submitted',
  'working',
  'input-required',
  'completed',
  'failed',
  'rejected',
] as const;

export type EstadoTareaA2a = (typeof ESTADOS_TAREA_A2A)[number];

/**
 * Habilidades (`skills[].id`) que el orquestador delega en los especialistas
 * (docs/03, 2.1 y 2.2). Son tambien los nombres de las dos herramientas de
 * delegacion que ve el modelo del orquestador en B2 y B3 (decision 44).
 */
export const HABILIDADES_A2A = ['knowledge_lookup', 'incident_diagnosis'] as const;

export type HabilidadA2a = (typeof HABILIDADES_A2A)[number];

/** Identificadores de los tres artefactos del protocolo (docs/03, 4). */
export const ARTEFACTOS_A2A = ['politica_aplicable', 'diagnostico', 'resultado_triaje'] as const;

export type ArtefactoA2a = (typeof ARTEFACTOS_A2A)[number];

/**
 * Lo que el orquestador pide a un especialista: la habilidad y los argumentos
 * que emitio su modelo. Viaja como `DataPart` del mensaje `message/send` en B3
 * y como objeto en proceso en B2, con la misma forma en ambas (RNF-01).
 */
export interface SolicitudEspecialistaDto {
  readonly habilidad: HabilidadA2a;
  readonly entrada: Readonly<Record<string, unknown>>;
}

/**
 * Claves de `metadata` de la tarea A2A que UniHelp agrega encima del protocolo.
 * El prefijo `unihelp/` evita chocar con claves del protocolo, igual que en MCP.
 */
export const META_A2A = {
  /**
   * En la tarea que devuelve el especialista: {@link MedicionReceptorDto}. Es lo
   * que permite `transport_ms = rtt - duracion_ms` sin restar marcas de tiempo
   * de procesos distintos (D5, RM-05).
   */
  medicion: 'unihelp/medicion',
  /** En una tarea `failed`: por que el especialista no pudo completar, en español (RM-11). */
  motivo: 'unihelp/motivo',
} as const;

/**
 * Lo que el especialista midio de si mismo mientras atendia la solicitud, con
 * los nombres de campo de `traza.schema.json`. El orquestador lo suma a su
 * propia medicion: `usage` de la traza es el consumo de TODOS los agentes y
 * `tool_calls` incluye las llamadas que hizo cada especialista, con su
 * `agente` (docs/05; HU-34). Todas las duraciones son de reloj monotono del
 * receptor (D6).
 */
export interface MedicionReceptorDto {
  /** Entrada -> salida del especialista, lo que el emisor resta al `rtt` del salto. */
  readonly duracion_ms: number;
  readonly llm_ms: number;
  readonly tool_exec_ms: number;
  /** Transporte de las llamadas MCP que el especialista hizo por su cuenta. */
  readonly transport_ms: number;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cached_input_tokens: number;
    readonly llm_calls: number;
  };
  /** `seq` local al especialista, desde 1; el orquestador lo renumera al fusionar. */
  readonly tool_calls: readonly LlamadaHerramientaDto[];
  /** Como termino el bucle del especialista: `respuesta`, `timeout`, `limite_herramientas`. */
  readonly terminacion: string;
}

/** Metadatos de trazabilidad y tiempo para la medicion de saltos de red A2A (doc 03 §6). */
export interface MetadataMensajeA2aDto {
  readonly traceId: string;
  readonly hop: number;
  readonly emisor: string;
  readonly receptor: string;
  readonly t_emision: string;
  /**
   * Presupuesto que le queda a la conversacion del orquestador (RNF-04). El
   * especialista no debe tardar mas que esto; si falta, usa su propio limite.
   */
  readonly tiempo_restante_ms?: number;
}

/** Parte textual en un mensaje o artefacto A2A. */
export interface A2aTextPartDto {
  readonly kind: 'text';
  readonly text: string;
}

/** Parte con datos JSON estructurados en un mensaje o artefacto A2A. */
export interface A2aDataPartDto<T = unknown> {
  readonly kind: 'data';
  readonly data: T;
}

/** Tipo de union para las partes de un mensaje o artefacto. */
export type A2aPartDto<T = unknown> = A2aTextPartDto | A2aDataPartDto<T>;

/** Artefacto A2A generado por un especialista o el orquestador (HU-30). */
export interface A2aArtifactDto<T = unknown> {
  readonly artifactId: string;
  readonly name?: string;
  readonly parts: readonly (A2aTextPartDto | A2aDataPartDto<T>)[];
}

/** Mensaje en el contexto de una conversacion o tarea A2A. */
export interface A2aMessageDto {
  readonly role: 'user' | 'agent';
  readonly parts: readonly A2aPartDto[];
  readonly metadata?: MetadataMensajeA2aDto;
}

/** Estado completo de una tarea en el ciclo de vida A2A. */
export interface A2aTaskDto {
  readonly id: string;
  readonly status: EstadoTareaA2a;
  readonly messages: readonly A2aMessageDto[];
  readonly artifacts: readonly A2aArtifactDto[];
  /** Claves de {@link META_A2A}: lo que no es para el modelo ni para la persona. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Politica citada en el artefacto de conocimiento (HU-30, doc 03 §4.1). */
export interface PoliticaCitadaDto {
  readonly codigo: string;
  readonly titulo: string;
  readonly version: string;
  readonly extracto: string;
  readonly relevancia: number;
}

/**
 * Contenido estructurado del artefacto `politica_aplicable` devuelto por
 * `b3-a2a-conocimiento` (HU-30, doc 03 §4.1).
 */
export interface ArtefactoPoliticaAplicableDataDto {
  readonly politicas: readonly PoliticaCitadaDto[];
  readonly resumen: string;
  readonly confianza: 'alta' | 'media' | 'baja';
  readonly sin_resultados: boolean;
}

/** Accion recomendada por el especialista de diagnostico (HU-30, doc 03 §4.2). */
export type AccionRecomendadaDiagnostico =
  'crear_ticket' | 'informar_y_esperar' | 'escalar' | 'sin_accion';

/**
 * Contenido estructurado del artefacto `diagnostico` que emite el especialista
 * de diagnostico (HU-30, doc 03 §4.2). `ventana_estimada` y `nivel_servicio`
 * se agregan a lo que fija el documento porque el prompt base obliga a informar
 * la ventana de restablecimiento solo si el servicio la publico (HU-10), y el
 * orquestador no consulta el estado por su cuenta.
 */
export interface ArtefactoDiagnosticoDataDto {
  readonly servicio: string;
  readonly estado: string;
  readonly alcance: string | null;
  readonly componentes_afectados: readonly string[];
  readonly sintomas_correlacionados: readonly string[];
  readonly prioridad_sugerida: string | null;
  readonly justificacion_prioridad: string;
  readonly accion_recomendada: AccionRecomendadaDiagnostico;
  readonly incidente_ref: string | null;
  readonly ventana_estimada?: string | null;
  readonly nivel_servicio?: string | null;
}

/** Metodo JSON-RPC 2.0 con el que un agente envia un mensaje a otro (A2A v1.0). */
export const METODO_A2A_MESSAGE_SEND = 'message/send';

/**
 * Codigos de error JSON-RPC que usan los agentes. Los tres primeros son los del
 * estandar; `infraestructura` es del rango reservado al servidor y significa
 * que el especialista no pudo trabajar por una causa ajena a la arquitectura
 * (proveedor del modelo, servidor MCP): el emisor lo traduce a
 * `ErrorInfraestructura` (RM-15).
 */
export const CODIGOS_JSONRPC = {
  metodoNoSoportado: -32601,
  parametrosInvalidos: -32602,
  interno: -32603,
  infraestructura: -32000,
} as const;

/** Parametros de `message/send`. `contextId` identifica la conversacion del orquestador. */
export interface MessageSendParamsDto {
  readonly message: A2aMessageDto;
  readonly contextId?: string;
  readonly taskId?: string;
}

export interface JsonRpcPeticionDto<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params?: T;
}

export interface JsonRpcErrorDto {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcRespuestaDto<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly result?: T;
  readonly error?: JsonRpcErrorDto;
}

/**
 * Contenido estructurado del artefacto `resultado_triaje` emitido por el
 * orquestador para su evaluacion homogenea (HU-30, doc 03 §4.3).
 */
export interface ArtefactoResultadoTriajeDataDto {
  readonly clasificacion: string;
  readonly politicas_citadas: readonly string[];
  readonly diagnostico: {
    readonly servicio: string;
    readonly prioridad: string;
  } | null;
  readonly ticket: {
    readonly creado: boolean;
    readonly id: string | null;
  };
  readonly confirmacion: {
    readonly solicitada: boolean;
    readonly otorgada: boolean;
  };
  readonly agentes_consultados: readonly string[];
}

/**
 * Contratos de red para el protocolo Agent2Agent (A2A v1.0) en la condicion B3.
 *
 * Define la estructura de las Agent Cards publicadas por cada agente en
 * `/.well-known/agent-card.json`, el ciclo de vida de las tareas A2A, los
 * mensajes JSON-RPC 2.0 y los artefactos fuertemente tipados intercambiados
 * entre el orquestador y los especialistas (HU-29, HU-30, RNF-04, doc 03).
 */

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

/** Metadatos de trazabilidad y tiempo para la medicion de saltos de red A2A (doc 03 §6). */
export interface MetadataMensajeA2aDto {
  readonly traceId: string;
  readonly hop: number;
  readonly emisor: string;
  readonly receptor: string;
  readonly t_emision: string;
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
 * Contenido estructurado del artefacto `diagnostico` devuelto por
 * `b3-a2a-diagnostico` (HU-30, doc 03 §4.2).
 */
export interface ArtefactoDiagnosticoDataDto {
  readonly servicio: string;
  readonly estado: string;
  readonly alcance: string;
  readonly componentes_afectados: readonly string[];
  readonly sintomas_correlacionados: readonly string[];
  readonly prioridad_sugerida: string;
  readonly justificacion_prioridad: string;
  readonly accion_recomendada: AccionRecomendadaDiagnostico;
  readonly incidente_ref: string | null;
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

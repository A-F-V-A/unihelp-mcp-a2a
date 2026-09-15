/**
 * GENERADO desde experiment/schemas/traza.schema.json con `pnpm nx run trazas:generar`.
 * NO editar a mano: se cambia el esquema y se regenera en el mismo commit.
 */

/**
 * Duracion en milisegundos medida con reloj monotono (decision de medicion D6).
 */
export type DuracionMs = number

/**
 * Traza de UNA ejecucion (tarea x arquitectura x repeticion). Fuente unica de los datos de las metricas: una traza que no valida contra este esquema no entra al conjunto oficial. Cualquier cambio exige subir version_esquema y regenerar los tipos de libs/trazas en el mismo commit (HU-MET-01).
 */
export interface TrazaEjecucion {
/**
 * Version de este esquema con la que se produjo la traza.
 */
version_esquema: "1.0.0"
/**
 * Identificador unico de la ejecucion. Ej.: T-COM-004|B3|r3|20261014T031102Z.
 */
run_id: string
/**
 * Identificador de correlacion que viaja por los servicios y el registro de auditoria.
 */
trace_id: string
/**
 * Tarea del conjunto de evaluacion (docs/tasks).
 */
task_id: string
/**
 * Arquitectura que resolvio la ejecucion.
 */
condition: ("B0" | "B1" | "B2" | "B3")
/**
 * Repeticion de la tarea en la arquitectura, desde 1.
 */
repetition: number
provenance: Procedencia
model?: Modelo
timing: Tiempos
usage: Consumo
conversation?: Turno[]
/**
 * Llamadas a herramienta en orden de emision. Arreglo vacio si no hubo ninguna.
 */
tool_calls: LlamadaHerramienta[]
a2a: MensajeriaAgentes
/**
 * Eventos del registro de auditoria del servidor para este trace_id.
 */
server_audit?: EventoAuditoria[]
outcome: Resultado
errors?: ErrorEjecucion[]
}
export interface Procedencia {
/**
 * Huella del estado inicial devuelta por el restablecimiento (M7.2).
 */
state_hash_inicial: string
/**
 * Semilla de la corrida.
 */
semilla: number
/**
 * Commit del codigo que produjo la traza.
 */
version_codigo: string
/**
 * Identificador exacto del modelo, con fecha de snapshot.
 */
modelo_id: string
config_hash?: string
dataset_version?: string
prompt_hash?: string
docker_images?: {
[k: string]: string
}
llm_mode?: ("record" | "replay" | "live")
cassette_path?: string
}
export interface Modelo {
provider?: string
id?: string
snapshot?: string
temperature?: number
top_p?: number
max_tokens?: number
judge_model?: (string | null)
}
export interface Tiempos {
/**
 * Reloj de pared, solo para ordenar y auditar; ninguna duracion se calcula con el (D6). ISO 8601.
 */
started_at?: string
/**
 * ISO 8601.
 */
ended_at?: string
/**
 * Latencia de extremo a extremo sin la espera de confirmacion (M4.1).
 */
total_ms: number
breakdown: {
llm_ms: DuracionMs
tool_exec_ms: DuracionMs
/**
 * Duracion en milisegundos medida con reloj monotono (decision de medicion D6).
 */
transport_ms: number
/**
 * Duracion en milisegundos medida con reloj monotono (decision de medicion D6).
 */
orchestration_ms: number
}
}
/**
 * Consumo del modelo sumado entre todos los agentes. Obligatorio y no nulo: una traza sin consumo de tokens es INVALIDA, no incompleta (HU-MET-01).
 */
export interface Consumo {
input_tokens: number
output_tokens: number
/**
 * Debe ser 0 en la corrida oficial (decision de medicion D2).
 */
cached_input_tokens?: number
llm_calls: number
/**
 * Costo estimado en dolares con la tarifa congelada en la configuracion (M4.7).
 */
cost_usd_est: number
}
export interface Turno {
turno: number
rol: ("usuario" | "agente")
texto: string
}
export interface LlamadaHerramienta {
/**
 * Posicion en la secuencia de llamadas de la ejecucion, desde 1 (M2.4).
 */
seq: number
nombre: string
args: {
[k: string]: unknown
}
isError: boolean
/**
 * ok o el codigo de error de la herramienta (VALIDACION_ENTRADA, CONFIRMACION_REQUERIDA, ...).
 */
resultado_status: string
agente?: string
transporte?: string
/**
 * Contenido devuelto por la herramienta; lo usa la fidelidad de citacion (M3.1).
 */
resultado?: {
[k: string]: unknown
}
resultado_resumen?: {
[k: string]: unknown
}
latency_ms?: DuracionMs
}
export interface MensajeriaAgentes {
/**
 * Mensajes entre agentes. Cero en B0 y B1; en B2 se cuentan las invocaciones en proceso equivalentes (M4.5).
 */
mensajes_totales: number
task_id?: string
estados?: {
[k: string]: unknown
}[]
hops?: {
[k: string]: unknown
}[]
artefactos?: string[]
}
export interface EventoAuditoria {
accion: string
resultado: string
[k: string]: unknown
}
export interface Resultado {
/**
 * Estado final. Lista cerrada: su tratamiento en efectividad, latencia y costo esta en experiment/metricas.yaml.
 */
status: ("ok" | "timeout" | "limite_herramientas" | "error_agente" | "error_infraestructura" | "esquema_invalido")
/**
 * Respuesta final entregada a la persona; null si la ejecucion no llego a responder.
 */
final_answer: (string | null)
final_json?: ({
[k: string]: unknown
} | null)
confirmacion_solicitada: boolean
confirmacion_otorgada?: (boolean | null)
tickets_creados: string[]
rechazos_servidor?: {
[k: string]: unknown
}[]
}
export interface ErrorEjecucion {
tipo: string
mensaje: string
[k: string]: unknown
}

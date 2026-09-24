import type { IdentificadorArquitectura } from '@unihelp/dominio';

/**
 * Una corrida del ejecutor (`experiment/corridas/<nombre>/`) leida tal cual:
 * trazas, puntuaciones de la compuerta automatica y manifiesto. El panel las
 * muestra ejecucion por ejecucion y NUNCA agrega una cifra a partir de ellas:
 * toda tasa o mediana sale del cuaderno de analisis (RM-02, decision 19).
 */

/** Estados finales de una ejecucion (experiment/schemas/traza.schema.json). */
export const ESTADOS_EJECUCION = [
  'ok',
  'timeout',
  'limite_herramientas',
  'error_agente',
  'error_infraestructura',
  'esquema_invalido',
] as const;

export type EstadoEjecucion = (typeof ESTADOS_EJECUCION)[number];

export const MODOS_LLM = ['live', 'record', 'replay'] as const;

export type ModoLlm = (typeof MODOS_LLM)[number];

/** Lo que el ejecutor deja escrito en `manifiesto.json`. Los conteos los hizo el ejecutor. */
export interface ManifiestoCorrida {
  readonly generadoEn: Date;
  readonly actualizadoEn: Date;
  readonly versionCodigo: string;
  readonly configHash: string;
  readonly semilla: number;
  readonly modoLlm: ModoLlm;
  readonly arquitecturas: readonly IdentificadorArquitectura[];
  readonly repeticiones: number;
  readonly tareas: number;
  readonly ejecuciones: number;
  readonly trazasValidas: number;
  readonly enCuarentena: number;
  readonly compuertaSuperada: number;
  readonly fallosDeInfraestructura: readonly string[];
  /** `false` mientras la tarifa siga en cero: un costo cero no es un costo medido (M4.7). */
  readonly tarifaConfigurada: boolean;
  readonly juez: string;
  readonly reejecuciones: number;
}

/** Entrada del catalogo `corridas/indice.json` que escribe el ejecutor. */
export interface ResumenCorrida {
  readonly nombre: string;
  /** `null` si la corrida se interrumpio antes de escribir el manifiesto. */
  readonly manifiesto: ManifiestoCorrida | null;
  readonly archivos: readonly string[];
}

export interface CatalogoCorridas {
  readonly generadoEn: Date;
  /** Mas reciente primero; a igual fecha, por nombre (RM-10). */
  readonly corridas: readonly ResumenCorrida[];
}

export interface DesgloseLatencia {
  readonly modeloMs: number;
  readonly herramientaMs: number;
  readonly transporteMs: number;
  readonly orquestacionMs: number;
}

export interface ConsumoEjecucion {
  readonly tokensEntrada: number;
  readonly tokensSalida: number;
  readonly tokensEntradaCacheados: number | null;
  readonly llamadasModelo: number;
  readonly costoUsdEstimado: number;
}

export interface TurnoEjecucion {
  readonly turno: number;
  readonly rol: 'usuario' | 'agente';
  readonly texto: string;
}

export interface LlamadaHerramientaEjecucion {
  readonly seq: number;
  readonly nombre: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly esError: boolean;
  readonly estadoResultado: string;
  readonly resultado: unknown;
  readonly latenciaMs: number | null;
  readonly agente: string | null;
  readonly transporte: string | null;
}

export interface EventoAuditoriaEjecucion {
  readonly accion: string;
  readonly resultado: string;
  readonly actor: string | null;
  readonly recurso: string | null;
  readonly motivo: string | null;
}

export interface ProcedenciaEjecucion {
  readonly huellaEstadoInicial: string;
  readonly semilla: number;
  readonly versionCodigo: string;
  readonly modeloId: string;
  readonly configHash: string | null;
  readonly modoLlm: ModoLlm | null;
}

/** Veredicto de la compuerta automatica para una ejecucion (`puntuaciones.jsonl`). */
export interface PuntuacionEjecucion {
  readonly exito: boolean;
  readonly compuertaAutomatica: boolean;
  /** `null` mientras no exista el juez; el juez solo puede quitar exito (RM-16). */
  readonly veredictoJuez: boolean | null;
  /** Motivos con la forma `verificacion:detalle`, tal como los escribe la compuerta. */
  readonly motivos: readonly string[];
}

export interface EjecucionCorrida {
  readonly runId: string;
  readonly traceId: string;
  readonly tareaId: string;
  readonly arquitectura: IdentificadorArquitectura;
  readonly repeticion: number;
  readonly estado: EstadoEjecucion;
  readonly iniciadaEn: Date | null;
  readonly terminadaEn: Date | null;
  readonly duracionMs: number;
  readonly desglose: DesgloseLatencia;
  readonly consumo: ConsumoEjecucion;
  readonly modeloId: string | null;
  readonly conversacion: readonly TurnoEjecucion[];
  readonly herramientas: readonly LlamadaHerramientaEjecucion[];
  readonly mensajesEntreAgentes: number;
  readonly auditoria: readonly EventoAuditoriaEjecucion[];
  readonly respuestaFinal: string | null;
  readonly objetoFinal: unknown;
  readonly confirmacionSolicitada: boolean;
  readonly confirmacionOtorgada: boolean | null;
  readonly ticketsCreados: readonly unknown[];
  readonly errores: readonly { readonly tipo: string; readonly mensaje: string }[];
  readonly procedencia: ProcedenciaEjecucion;
  /** `null` si la traza fue a cuarentena: una traza invalida no se puntua. */
  readonly puntuacion: PuntuacionEjecucion | null;
  readonly enCuarentena: boolean;
  /** Errores del esquema, solo para las de cuarentena. */
  readonly erroresEsquema: readonly string[];
}

export interface CorridaDetallada {
  readonly nombre: string;
  readonly manifiesto: ManifiestoCorrida | null;
  /** Ordenadas por tarea, arquitectura y repeticion (RM-10). */
  readonly ejecuciones: readonly EjecucionCorrida[];
  /** Huella de estado inicial esperada por tarea (M7.2). */
  readonly huellasEsperadas: Readonly<Record<string, string>>;
  /** Contenido de `reejecuciones.md`, si hubo fallos de infraestructura (RM-15). */
  readonly reejecuciones: string | null;
}

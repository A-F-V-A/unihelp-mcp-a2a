/**
 * Forma en disco de los archivos que lee el panel del experimento. NO son
 * contratos de `libs/contratos` a proposito: ningun DTO de red transporta
 * metricas calculadas (decision 19). Sus fuentes de verdad son:
 *
 * - `experiment/schemas/traza.schema.json` (trazas) y
 *   `experiment/schemas/resultados.schema.json` (resultados), ambos con
 *   `version_esquema` que el mapper comprueba;
 * - `experiment/ejecutor/corrida.py` (manifiesto, puntuaciones, indice);
 * - `experiment/analisis/salida.py` (manifiesto de salidas).
 *
 * Los nombres se conservan en `snake_case` porque son los del registro de
 * metricas (decision 22). Solo se declaran los campos que el panel usa.
 */

export interface ManifiestoCorridaDto {
  readonly generado_en: string;
  readonly actualizado_en: string;
  readonly version_codigo: string;
  readonly config_hash: string;
  readonly semilla: number;
  readonly modo_llm: string;
  readonly arquitecturas: readonly string[];
  readonly repeticiones: number;
  readonly tareas: number;
  readonly ejecuciones: number;
  readonly trazas_validas: number;
  readonly en_cuarentena: number;
  readonly compuerta_superada: number;
  readonly fallos_de_infraestructura: readonly string[];
  readonly tarifa_configurada: boolean;
  readonly juez: string;
  readonly reejecuciones: readonly unknown[];
}

export interface IndiceCorridasDto {
  readonly generado_en: string;
  readonly corridas: readonly {
    readonly nombre: string;
    readonly manifiesto: ManifiestoCorridaDto | null;
    readonly archivos: readonly string[];
  }[];
}

export interface PuntuacionDto {
  readonly run_id: string;
  readonly exito: boolean;
  readonly compuerta_automatica: boolean;
  readonly veredicto_juez: boolean | null;
  readonly motivos: readonly string[];
}

export interface TrazaDto {
  readonly version_esquema: string;
  readonly run_id: string;
  readonly trace_id: string;
  readonly task_id: string;
  readonly condition: string;
  readonly repetition: number;
  readonly provenance: {
    readonly state_hash_inicial: string;
    readonly semilla: number;
    readonly version_codigo: string;
    readonly modelo_id: string;
    readonly config_hash?: string;
    readonly llm_mode?: string;
  };
  readonly model?: { readonly id?: string };
  readonly timing: {
    readonly started_at?: string;
    readonly ended_at?: string;
    readonly total_ms: number;
    readonly breakdown: {
      readonly llm_ms: number;
      readonly tool_exec_ms: number;
      readonly transport_ms: number;
      readonly orchestration_ms: number;
    };
  };
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cached_input_tokens?: number;
    readonly llm_calls: number;
    readonly cost_usd_est: number;
  };
  readonly conversation?: readonly {
    readonly turno: number;
    readonly rol: string;
    readonly texto: string;
  }[];
  readonly tool_calls: readonly {
    readonly seq: number;
    readonly nombre: string;
    readonly args: Record<string, unknown>;
    readonly isError: boolean;
    readonly resultado_status: string;
    readonly resultado?: unknown;
    readonly latency_ms?: number;
    readonly agente?: string;
    readonly transporte?: string;
  }[];
  readonly a2a: { readonly mensajes_totales: number };
  readonly server_audit?: readonly {
    readonly accion: string;
    readonly resultado: string;
    readonly actor?: string | null;
    readonly recurso?: string | null;
    readonly motivo?: string | null;
  }[];
  readonly outcome: {
    readonly status: string;
    readonly final_answer: string | null;
    readonly final_json?: unknown;
    readonly confirmacion_solicitada: boolean;
    readonly confirmacion_otorgada?: boolean | null;
    readonly tickets_creados: readonly unknown[];
  };
  readonly errors?: readonly { readonly tipo: string; readonly mensaje: string }[];
}

/** Sobre de `cuarentena/trazas.jsonl`: la traza que no valido, con sus errores. */
export interface SobreCuarentenaDto {
  readonly traza: TrazaDto;
  readonly errores: readonly string[];
  readonly estado_original: string;
}

export interface HuellasEsperadasDto {
  readonly dataset_version: string;
  readonly huellas: Readonly<Record<string, string>>;
}

export interface IntervaloDto {
  readonly inferior: number;
  readonly superior: number;
  readonly nivel: number;
}

export interface FilaDto {
  readonly arquitectura: string | null;
  readonly dimensiones: Readonly<Record<string, string>>;
  readonly estadistico: string;
  readonly valor: number | null;
  readonly intervalo: IntervaloDto | null;
  readonly n_tareas: number | null;
  readonly n_observaciones: number | null;
}

export interface ContrasteDto {
  readonly minuendo: string;
  readonly sustraendo: string;
  readonly dimensiones: Readonly<Record<string, string>>;
  readonly estadistico: string;
  readonly diferencia: number | null;
  readonly intervalo: IntervaloDto | null;
  readonly n_tareas: number;
}

export interface UmbralDto {
  readonly operador: string;
  readonly valor?: number;
  readonly arquitecturas?: readonly string[];
  readonly alcance?: string;
  readonly descripcion: string;
  readonly consecuencia?: string;
  readonly observado: number | Readonly<Record<string, number | null>> | null;
  readonly alcanza: boolean | null;
}

export interface MetricaDto {
  readonly codigo: string;
  readonly familia: string;
  readonly nombre: string;
  readonly rol: string;
  readonly hipotesis: readonly string[];
  readonly tipo_valor_esperado: string;
  readonly unidad: string;
  readonly direccion: string;
  readonly unidad_analisis: string;
  readonly estado: string;
  readonly motivo_estado: string | null;
  readonly filas: readonly FilaDto[];
  readonly contrastes: readonly ContrasteDto[];
  readonly notas: readonly string[];
  readonly umbral?: UmbralDto;
}

export interface ResultadosDto {
  readonly version_esquema_resultados: string;
  readonly generado_en: string;
  readonly corrida: {
    readonly semilla: number | null;
    readonly version_codigo: string | null;
    readonly modelo_id: string | null;
    readonly version_registro: string;
    readonly version_esquema_traza: string;
    readonly arquitecturas: readonly string[];
    readonly tareas: {
      readonly total: number;
      readonly por_categoria: Readonly<Record<string, number>>;
    };
    readonly ejecuciones: {
      readonly intentadas: number;
      readonly validas: number;
      readonly invalidas: number;
      readonly por_motivo: Readonly<Record<string, number>>;
    };
    readonly inferencia: {
      readonly unidad: string;
      readonly tamano_muestra: number;
      readonly metodo: string;
      readonly replicas: number;
      readonly nivel: number;
      readonly semilla: number;
    };
  };
  readonly validacion: {
    readonly umbral_aviso_residuo: number;
    readonly avisos_residuo: readonly { readonly ejecucion: string; readonly proporcion: number }[];
    readonly rechazos: readonly {
      readonly origen: string;
      readonly ejecucion: string | null;
      readonly motivos: readonly string[];
      readonly detalle: readonly string[];
    }[];
  };
  readonly metricas: readonly MetricaDto[];
}

export interface ManifiestoSalidasDto {
  readonly resultados: { readonly archivo: string; readonly sha256_sin_marca_tiempo: string };
  readonly salidas: readonly {
    readonly archivo: string;
    readonly etiqueta: string;
    readonly sha256: string;
  }[];
}

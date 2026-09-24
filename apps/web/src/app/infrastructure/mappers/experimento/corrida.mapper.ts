import { esIdentificadorArquitectura } from '@unihelp/dominio';
import { ErrorBackend } from '../../../domain/errors/error-backend';
import {
  type CatalogoCorridas,
  type CorridaDetallada,
  ESTADOS_EJECUCION,
  type EjecucionCorrida,
  type EstadoEjecucion,
  MODOS_LLM,
  type ManifiestoCorrida,
  type ModoLlm,
  type PuntuacionEjecucion,
} from '../../../domain/models/experimento/corrida';
import { ordenarEjecuciones } from '../../../domain/rules/experimento/ejecuciones.rules';
import type {
  HuellasEsperadasDto,
  IndiceCorridasDto,
  ManifiestoCorridaDto,
  PuntuacionDto,
  SobreCuarentenaDto,
  TrazaDto,
} from '../../estaticos/experimento.dto';

/** Version del esquema de traza que este mapper sabe leer. */
export const VERSION_TRAZA_CONOCIDA = '1.0.0';

export function mapearManifiestoCorrida(dto: ManifiestoCorridaDto): ManifiestoCorrida {
  return {
    generadoEn: new Date(dto.generado_en),
    actualizadoEn: new Date(dto.actualizado_en),
    versionCodigo: dto.version_codigo,
    configHash: dto.config_hash,
    semilla: dto.semilla,
    modoLlm: modoLlm(dto.modo_llm) ?? 'record',
    arquitecturas: dto.arquitecturas.filter(esIdentificadorArquitectura),
    repeticiones: dto.repeticiones,
    tareas: dto.tareas,
    ejecuciones: dto.ejecuciones,
    trazasValidas: dto.trazas_validas,
    enCuarentena: dto.en_cuarentena,
    compuertaSuperada: dto.compuerta_superada,
    fallosDeInfraestructura: [...dto.fallos_de_infraestructura],
    tarifaConfigurada: dto.tarifa_configurada,
    juez: dto.juez,
    reejecuciones: dto.reejecuciones.length,
  };
}

export function mapearCatalogoCorridas(dto: IndiceCorridasDto): CatalogoCorridas {
  return {
    generadoEn: new Date(dto.generado_en),
    corridas: dto.corridas.map((corrida) => ({
      nombre: corrida.nombre,
      manifiesto: corrida.manifiesto ? mapearManifiestoCorrida(corrida.manifiesto) : null,
      archivos: [...corrida.archivos],
    })),
  };
}

/** Una linea JSONL por objeto; las vacias se ignoran. Una linea ilegible rechaza toda la lectura. */
export function parsearJsonl<T>(contenido: string, nombre: string): T[] {
  return contenido
    .split(/\r?\n/)
    .filter((linea) => linea.trim().length > 0)
    .map((linea, indice) => {
      try {
        return JSON.parse(linea) as T;
      } catch {
        throw new ErrorBackend('validacion', `${nombre}: la linea ${indice + 1} no es JSON.`);
      }
    });
}

export interface ArchivosCorrida {
  readonly nombre: string;
  readonly manifiesto: ManifiestoCorridaDto | null;
  readonly trazas: readonly TrazaDto[];
  readonly cuarentena: readonly SobreCuarentenaDto[];
  readonly puntuaciones: readonly PuntuacionDto[];
  readonly huellas: HuellasEsperadasDto | null;
  readonly reejecuciones: string | null;
}

/**
 * Une trazas y puntuaciones por `run_id` y agrega las de cuarentena sin
 * puntuacion (una traza invalida no se puntua). El orden final es el de
 * `ordenarEjecuciones`, no el del archivo (RM-10).
 */
export function mapearCorridaDetallada(archivos: ArchivosCorrida): CorridaDetallada {
  const puntuaciones = new Map(archivos.puntuaciones.map((p) => [p.run_id, mapearPuntuacion(p)]));
  const validas = archivos.trazas.map((traza) =>
    mapearEjecucion(traza, puntuaciones.get(traza.run_id) ?? null, false, []),
  );
  const cuarentena = archivos.cuarentena.map((sobre) =>
    mapearEjecucion(sobre.traza, null, true, sobre.errores, sobre.estado_original),
  );
  return {
    nombre: archivos.nombre,
    manifiesto: archivos.manifiesto ? mapearManifiestoCorrida(archivos.manifiesto) : null,
    ejecuciones: ordenarEjecuciones([...validas, ...cuarentena]),
    huellasEsperadas: { ...(archivos.huellas?.huellas ?? {}) },
    reejecuciones: archivos.reejecuciones,
  };
}

export function mapearPuntuacion(dto: PuntuacionDto): PuntuacionEjecucion {
  return {
    exito: dto.exito,
    compuertaAutomatica: dto.compuerta_automatica,
    veredictoJuez: dto.veredicto_juez,
    motivos: [...dto.motivos],
  };
}

export function mapearEjecucion(
  traza: TrazaDto,
  puntuacion: PuntuacionEjecucion | null,
  enCuarentena: boolean,
  erroresEsquema: readonly string[],
  estadoOriginal?: string,
): EjecucionCorrida {
  if (traza.version_esquema !== VERSION_TRAZA_CONOCIDA) {
    throw new ErrorBackend(
      'validacion',
      `La traza ${traza.run_id} usa el esquema ${traza.version_esquema}; el panel conoce ${VERSION_TRAZA_CONOCIDA}.`,
    );
  }
  if (!esIdentificadorArquitectura(traza.condition)) {
    throw new ErrorBackend('validacion', `La traza ${traza.run_id} no tiene arquitectura legible.`);
  }
  return {
    runId: traza.run_id,
    traceId: traza.trace_id,
    tareaId: traza.task_id,
    arquitectura: traza.condition,
    repeticion: traza.repetition,
    // En cuarentena el ejecutor sobrescribe el estado a `esquema_invalido` y
    // guarda el original aparte; el original es el que explica que paso (RM-15).
    estado: estadoEjecucion(estadoOriginal ?? traza.outcome.status),
    iniciadaEn: fecha(traza.timing.started_at),
    terminadaEn: fecha(traza.timing.ended_at),
    duracionMs: traza.timing.total_ms,
    desglose: {
      modeloMs: traza.timing.breakdown.llm_ms,
      herramientaMs: traza.timing.breakdown.tool_exec_ms,
      transporteMs: traza.timing.breakdown.transport_ms,
      orquestacionMs: traza.timing.breakdown.orchestration_ms,
    },
    consumo: {
      tokensEntrada: traza.usage.input_tokens,
      tokensSalida: traza.usage.output_tokens,
      tokensEntradaCacheados: traza.usage.cached_input_tokens ?? null,
      llamadasModelo: traza.usage.llm_calls,
      costoUsdEstimado: traza.usage.cost_usd_est,
    },
    modeloId: traza.model?.id ?? traza.provenance.modelo_id ?? null,
    conversacion: (traza.conversation ?? []).map((turno) => ({
      turno: turno.turno,
      rol: turno.rol === 'usuario' ? 'usuario' : 'agente',
      texto: turno.texto,
    })),
    herramientas: traza.tool_calls.map((llamada) => ({
      seq: llamada.seq,
      nombre: llamada.nombre,
      args: { ...llamada.args },
      esError: llamada.isError,
      estadoResultado: llamada.resultado_status,
      resultado: llamada.resultado ?? null,
      latenciaMs: llamada.latency_ms ?? null,
      agente: llamada.agente ?? null,
      transporte: llamada.transporte ?? null,
    })),
    mensajesEntreAgentes: traza.a2a.mensajes_totales,
    auditoria: (traza.server_audit ?? []).map((evento) => ({
      accion: evento.accion,
      resultado: evento.resultado,
      actor: evento.actor ?? null,
      recurso: evento.recurso ?? null,
      motivo: evento.motivo ?? null,
    })),
    respuestaFinal: traza.outcome.final_answer,
    objetoFinal: traza.outcome.final_json ?? null,
    confirmacionSolicitada: traza.outcome.confirmacion_solicitada,
    confirmacionOtorgada: traza.outcome.confirmacion_otorgada ?? null,
    ticketsCreados: [...traza.outcome.tickets_creados],
    errores: (traza.errors ?? []).map((error) => ({ tipo: error.tipo, mensaje: error.mensaje })),
    procedencia: {
      huellaEstadoInicial: traza.provenance.state_hash_inicial,
      semilla: traza.provenance.semilla,
      versionCodigo: traza.provenance.version_codigo,
      modeloId: traza.provenance.modelo_id,
      configHash: traza.provenance.config_hash ?? null,
      modoLlm: modoLlm(traza.provenance.llm_mode),
    },
    puntuacion,
    enCuarentena,
    erroresEsquema: [...erroresEsquema],
  };
}

function estadoEjecucion(valor: string): EstadoEjecucion {
  return (ESTADOS_EJECUCION as readonly string[]).includes(valor)
    ? (valor as EstadoEjecucion)
    : 'esquema_invalido';
}

function modoLlm(valor: string | undefined): ModoLlm | null {
  return valor !== undefined && (MODOS_LLM as readonly string[]).includes(valor)
    ? (valor as ModoLlm)
    : null;
}

function fecha(valor: string | undefined): Date | null {
  if (!valor) {
    return null;
  }
  const resultado = new Date(valor);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

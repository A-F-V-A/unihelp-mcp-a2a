import { randomUUID } from 'node:crypto';
import type { OnModuleDestroy } from '@nestjs/common';
import {
  BucleAgente,
  type ConfiguracionAgente,
  type ClienteModelo,
  type IdentidadAgente,
  InstrumentadorTrazas,
  PresupuestoEjecucion,
  type ResultadoBucle,
  separarObjetoJson,
} from '@unihelp/agente-nucleo';
import type {
  A2aTaskDto,
  HabilidadA2a,
  MedicionReceptorDto,
  MetadataMensajeA2aDto,
} from '@unihelp/contratos';
import { META_A2A } from '@unihelp/contratos';
import { type PuertoCapacidades, ahoraMonotonoMs } from '@unihelp/herramientas';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { NOMBRE_ARTEFACTO, validadorDeArtefacto } from '../artefactos/esquemas-artefactos';
import { ARTEFACTO_DE_HABILIDAD, HABILIDAD_DE_ESPECIALISTA, type RolEspecialista } from '../roles';

/** Lo que el orquestador pide, ya desempaquetado del transporte (A2A o en proceso). */
export interface SolicitudAlEspecialista {
  readonly habilidad: HabilidadA2a;
  readonly entrada: Readonly<Record<string, unknown>>;
  /** La traza de la ejecucion del orquestador: la misma en todos los agentes (HU-33). */
  readonly traceId: string;
  readonly conversacionId: string;
  /** Presupuesto que le queda a la conversacion; `null` si el orquestador no lo dijo. */
  readonly tiempoRestanteMs: number | null;
  /** Salto con el que llego la solicitud; la respuesta lleva el siguiente. */
  readonly hop: number;
}

/** Aviso en español de por que el especialista no completo (RM-11). */
const MOTIVO_CORTE: Readonly<Record<string, string>> = {
  timeout: 'El especialista agotó el tiempo de procesamiento disponible.',
  limite_herramientas: 'El especialista alcanzó el máximo de consultas permitidas.',
  artefacto_invalido: 'El especialista no emitió un artefacto válido.',
  habilidad_ajena: 'El especialista no atiende esa habilidad.',
};

/**
 * Un agente especialista de B2 y B3 (decision 44): el MISMO bucle de function
 * calling que el agente unico (`BucleAgente`), con el prompt de su rol y un
 * puerto MCP restringido a su unica herramienta (HU-20). Atiende UNA solicitud
 * del orquestador y devuelve la tarea A2A con su artefacto (docs/03, 4) y, en
 * `metadata`, lo que midio de si mismo: duracion, tiempos, consumo y llamadas,
 * para que el emisor calcule `transport_ms = rtt - duracion_ms` y fusione la
 * medicion en la traza de la ejecucion (D5, RM-05, HU-34).
 *
 * Cada solicitud es una conversacion nueva del especialista: no guarda estado
 * entre solicitudes (RNF-03) y la instrumentacion se crea por solicitud, asi
 * que dos solicitudes concurrentes con trazas distintas no se mezclan.
 *
 * Es el mismo codigo en B2 (en proceso) y en B3 (en su propio servicio): lo
 * unico que cambia es quien lo invoca y como viaja la solicitud.
 */
export class AgenteEspecialista implements OnModuleDestroy {
  readonly habilidad: HabilidadA2a;

  constructor(
    readonly rol: RolEspecialista,
    private readonly identidad: IdentidadAgente,
    private readonly prompt: string,
    private readonly modelo: ClienteModelo,
    private readonly capacidades: PuertoCapacidades,
    private readonly configuracion: ConfiguracionAgente,
    private readonly alCerrar: () => Promise<void> = async () => undefined,
  ) {
    this.habilidad = HABILIDAD_DE_ESPECIALISTA[rol];
  }

  /**
   * Atiende la solicitud. Lanza `ErrorInfraestructura` si el proveedor del
   * modelo o el servidor MCP no responden (RM-15); cualquier otra forma de no
   * poder completar vuelve como tarea `failed` con su motivo.
   */
  async atender(solicitud: SolicitudAlEspecialista): Promise<A2aTaskDto> {
    const inicio = ahoraMonotonoMs();
    const taskId = `task-${this.rol}-${randomUUID()}`;
    const instrumentador = new InstrumentadorTrazas(this.identidad);
    const { traceId } = solicitud;

    if (solicitud.habilidad !== this.habilidad) {
      instrumentador.cerrarTurno(traceId, ahoraMonotonoMs() - inicio, 'habilidad_ajena');
      return this.fallida(taskId, solicitud, 'habilidad_ajena', instrumentador);
    }

    // El presupuesto es el propio o lo que le quede a la conversacion del
    // orquestador, lo que sea menor (RNF-04). Se crea por solicitud.
    const limiteMs = Math.min(
      this.configuracion.limites.tiempoMs,
      solicitud.tiempoRestanteMs ?? Number.POSITIVE_INFINITY,
    );
    const presupuesto = new PresupuestoEjecucion({
      ...this.configuracion,
      limites: { ...this.configuracion.limites, tiempoMs: limiteMs },
    });
    const bucle = new BucleAgente(this.modelo, this.capacidades, presupuesto, instrumentador);
    const historial: ChatCompletionMessageParam[] = [
      { role: 'system', content: this.prompt },
      {
        role: 'user',
        content: `Solicitud del orquestador (${solicitud.habilidad}):\n${JSON.stringify(solicitud.entrada, null, 2)}`,
      },
    ];
    const contexto = {
      traceId,
      conversacionId: solicitud.conversacionId,
      actor: this.identidad.actor,
    };

    let resultado: ResultadoBucle;
    let motivo = 'error_agente';
    try {
      resultado = await bucle.atender(historial, contexto, inicio, this.configuracion.modelo.id);
      motivo = resultado.motivo;
    } finally {
      instrumentador.cerrarTurno(traceId, ahoraMonotonoMs() - inicio, motivo);
    }

    if (resultado.motivo !== 'respuesta') {
      return this.fallida(taskId, solicitud, resultado.motivo, instrumentador);
    }
    const artefacto = ARTEFACTO_DE_HABILIDAD[this.habilidad];
    const { objeto } = separarObjetoJson(
      resultado.contenidoFinal ?? '',
      validadorDeArtefacto(artefacto as 'politica_aplicable' | 'diagnostico'),
    );
    if (objeto === null) {
      return this.fallida(taskId, solicitud, 'artefacto_invalido', instrumentador);
    }
    return {
      id: taskId,
      status: 'completed',
      messages: [
        {
          role: 'agent',
          parts: [{ kind: 'text', text: textoDe(objeto) }],
          metadata: this.metadataRespuesta(solicitud),
        },
      ],
      artifacts: [
        {
          artifactId: artefacto,
          name: NOMBRE_ARTEFACTO[artefacto],
          parts: [{ kind: 'data', data: objeto }],
        },
      ],
      metadata: { [META_A2A.medicion]: medicionDe(instrumentador, traceId, motivo) },
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.alCerrar();
  }

  private fallida(
    taskId: string,
    solicitud: SolicitudAlEspecialista,
    motivo: string,
    instrumentador: InstrumentadorTrazas,
  ): A2aTaskDto {
    const texto =
      MOTIVO_CORTE[motivo] ?? `El especialista no pudo completar la solicitud (${motivo}).`;
    return {
      id: taskId,
      status: 'failed',
      messages: [
        {
          role: 'agent',
          parts: [{ kind: 'text', text: texto }],
          metadata: this.metadataRespuesta(solicitud),
        },
      ],
      artifacts: [],
      metadata: {
        [META_A2A.medicion]: medicionDe(instrumentador, solicitud.traceId, motivo),
        [META_A2A.motivo]: texto,
      },
    };
  }

  private metadataRespuesta(solicitud: SolicitudAlEspecialista): MetadataMensajeA2aDto {
    return {
      traceId: solicitud.traceId,
      hop: solicitud.hop + 1,
      emisor: this.rol,
      receptor: 'orquestador',
      t_emision: new Date().toISOString(),
    };
  }
}

/** Lo que el especialista midio de si mismo, con los nombres de la traza. */
function medicionDe(
  instrumentador: InstrumentadorTrazas,
  traceId: string,
  terminacion: string,
): MedicionReceptorDto {
  const m = instrumentador.de(traceId);
  return {
    duracion_ms: m.totalMs,
    llm_ms: m.llmMs,
    tool_exec_ms: m.toolExecMs,
    transport_ms: m.transportMs,
    usage: {
      input_tokens: m.inputTokens,
      output_tokens: m.outputTokens,
      cached_input_tokens: m.cachedInputTokens,
      llm_calls: m.llmCalls,
    },
    tool_calls: m.toolCalls.map((llamada) => ({ ...llamada })),
    terminacion,
  };
}

/** Texto del mensaje A2A: el resumen o la justificacion, si el artefacto lo trae. */
function textoDe(objeto: unknown): string {
  const datos = objeto as { resumen?: unknown; justificacion_prioridad?: unknown };
  if (typeof datos.resumen === 'string') {
    return datos.resumen;
  }
  if (typeof datos.justificacion_prioridad === 'string') {
    return datos.justificacion_prioridad;
  }
  return '';
}

import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import type {
  EntornoRestablecidoDto,
  EventoAuditoriaDto,
  MensajeriaAgentesDto,
  RestablecerEntornoDto,
  TrazaParcialDto,
} from '@unihelp/contratos';
import { CORPUS_CONOCIMIENTO } from '@unihelp/contratos';
import { RestablecerConocimientoUseCase } from '@unihelp/conocimiento';
import { ConsultarAuditoriaUseCase, RestablecerTicketsUseCase } from '@unihelp/tickets';
import { InstrumentadorTrazas, type MensajeriaAcumulada } from '../agente/instrumentador-trazas';
import {
  CONFIGURACION_AGENTE,
  type ConfiguracionAgente,
} from '../configuracion/configuracion-agente';
import { RepositorioConversaciones } from '../conversacion/repositorio-conversaciones';
import { ErrorApi } from '../http/error-api';
import { IDENTIDAD_AGENTE, type IdentidadAgente } from '../identidad-agente';

/**
 * Rutas del ejecutor del experimento (`RUTAS_EXPERIMENTO`), fuera del prefijo
 * `/api`. `AgenteNucleoModule` solo las registra con `UNIHELP_PERFIL=experimento`:
 * en cualquier otro perfil no existen (decision 32).
 *
 * No calcula ninguna metrica: entrega lo medido tal cual y el cuaderno de
 * Python es el unico que calcula (RM-02, decision 19). En particular el residuo
 * de orquestacion se reporta SIN corregir, aunque salga negativo, porque un
 * residuo negativo es un defecto de instrumentacion que el analisis debe ver y
 * rechazar (HU-MET-07).
 */
@Controller('experimento')
export class ExperimentoController {
  constructor(
    @Inject(RestablecerConocimientoUseCase)
    private readonly restablecerConocimiento: RestablecerConocimientoUseCase,
    @Inject(RestablecerTicketsUseCase)
    private readonly restablecerTickets: RestablecerTicketsUseCase,
    @Inject(ConsultarAuditoriaUseCase) private readonly auditoria: ConsultarAuditoriaUseCase,
    @Inject(InstrumentadorTrazas) private readonly instrumentador: InstrumentadorTrazas,
    @Inject(RepositorioConversaciones) private readonly conversaciones: RepositorioConversaciones,
    @Inject(CONFIGURACION_AGENTE) private readonly configuracion: ConfiguracionAgente,
    @Inject(IDENTIDAD_AGENTE) private readonly identidad: IdentidadAgente,
  ) {}

  /**
   * `POST /experimento/restablecer`: deja el entorno como lo pide la tarea y
   * devuelve la huella del estado inicial (HU-36). El orden importa: primero
   * tickets, porque sus filas referencian servicios de la base de conocimiento.
   */
  @Post('restablecer')
  @HttpCode(200)
  async restablecer(@Body() cuerpo: unknown): Promise<EntornoRestablecidoDto> {
    const datos = (cuerpo ?? {}) as Partial<RestablecerEntornoDto>;
    const estadoInicial = typeof datos.estadoInicial === 'string' ? datos.estadoInicial.trim() : '';
    if (estadoInicial === '') {
      throw new ErrorApi('validacion', 'Falta el campo estadoInicial.', { campo: 'estadoInicial' });
    }
    const corpus = CORPUS_CONOCIMIENTO.find((c) => c === datos.corpus);
    if (corpus === undefined) {
      throw new ErrorApi(
        'validacion',
        `El campo corpus debe ser ${CORPUS_CONOCIMIENTO.join(' o ')}.`,
        { campo: 'corpus' },
      );
    }

    const tickets = await this.restablecerTickets.ejecutar();
    const conocimiento = await this.restablecerConocimiento.ejecutar({
      estadoInicial,
      corpus,
    });
    // Las conversaciones viven en la memoria del proceso: si no se borran aqui,
    // la ejecucion siguiente podria reutilizar un historial de la anterior (RNF-03).
    this.conversaciones.vaciar();
    this.instrumentador.olvidarTodo();

    return {
      huella: conocimiento.huella,
      versionSemilla: conocimiento.versionSemilla,
      estadoInicial: conocimiento.estadoInicial,
      corpus: conocimiento.corpus,
      conteos: conocimiento.conteos,
      ticketsVaciados: tickets.vaciadas,
      auditoriaVaciada: tickets.auditoriaVaciada,
    };
  }

  /** `GET /experimento/trazas/:traceId`: lo que solo el agente sabe de la ejecucion. */
  @Get('trazas/:traceId')
  async traza(@Param('traceId') traceId: string): Promise<TrazaParcialDto> {
    const medicion = this.instrumentador.consultar(traceId);
    if (medicion === undefined) {
      throw new ErrorApi(
        'no-encontrado',
        `${this.identidad.arquitectura} no atendió ninguna ejecución «${traceId}».`,
        { traceId },
      );
    }
    const { eventos, tickets } = await this.auditoria.ejecutar(traceId);
    const modelo = this.configuracion.modelo;

    return {
      trace_id: traceId,
      timing: {
        total_ms: medicion.totalMs,
        breakdown: {
          llm_ms: medicion.llmMs,
          tool_exec_ms: medicion.toolExecMs,
          transport_ms: medicion.transportMs,
          orchestration_ms:
            medicion.totalMs - medicion.llmMs - medicion.toolExecMs - medicion.transportMs,
        },
      },
      usage: {
        input_tokens: medicion.inputTokens,
        output_tokens: medicion.outputTokens,
        cached_input_tokens: medicion.cachedInputTokens,
        llm_calls: medicion.llmCalls,
      },
      model: {
        provider: modelo.proveedor,
        id: modelo.id,
        temperature: modelo.temperatura,
        top_p: modelo.topP,
        max_tokens: modelo.maxTokens,
      },
      terminaciones: [...medicion.motivos],
      final_json: medicion.objetoFinal,
      tool_calls: medicion.toolCalls.map((llamada) => ({ ...llamada })),
      a2a: aMensajeriaDto(medicion.a2a),
      server_audit: eventos.map(aEventoDto),
      tickets_creados: tickets.map((ticket) => ticket.numero),
    };
  }
}

/**
 * `a2a` de la traza. Un agente unico no tuvo tarea ni saltos y entrega solo el
 * conteo en cero, que es lo que el esquema exige para B0 y B1 (M4.5); el
 * orquestador entrega la tarea, sus estados, los saltos y los artefactos.
 */
function aMensajeriaDto(a2a: MensajeriaAcumulada): MensajeriaAgentesDto {
  if (a2a.taskId === null && a2a.hops.length === 0 && a2a.estados.length === 0) {
    return { mensajes_totales: a2a.mensajesTotales };
  }
  return {
    mensajes_totales: a2a.mensajesTotales,
    ...(a2a.taskId === null ? {} : { task_id: a2a.taskId }),
    estados: a2a.estados.map((e) => ({ ...e })),
    hops: a2a.hops.map((h) => ({ ...h })),
    artefactos: [...a2a.artefactos],
  };
}

function aEventoDto(evento: {
  accion: string;
  resultado: string;
  actor: string;
  recurso: string;
  motivo: string | null;
  tokenValido: boolean | null;
  payloadHash: string;
}): EventoAuditoriaDto {
  return {
    accion: evento.accion,
    resultado: evento.resultado,
    actor: evento.actor,
    recurso: evento.recurso,
    motivo: evento.motivo,
    tokenValido: evento.tokenValido,
    payloadHash: evento.payloadHash,
  };
}

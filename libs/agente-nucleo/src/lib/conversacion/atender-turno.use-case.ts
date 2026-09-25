import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  EstadoTareaA2a,
  MensajeAsistenteDto,
  MensajeUsuarioDto,
  RespuestaMensajeDto,
  ResumenConversacionDto,
} from '@unihelp/contratos';
import { LONGITUD_SOLICITUD } from '@unihelp/dominio';
import { ahoraMonotonoMs } from '@unihelp/herramientas';
import { RegistrarTurnoUseCase } from '@unihelp/tickets';
import { BucleAgente, type ResultadoBucle } from '../agente/bucle-agente';
import { ExtractorObjetoFinal } from '../agente/extractor-objeto-final';
import { InstrumentadorTrazas } from '../agente/instrumentador-trazas';
import { PresupuestoEjecucion } from '../agente/presupuesto-ejecucion';
import {
  CONFIGURACION_AGENTE,
  type ConfiguracionAgente,
} from '../configuracion/configuracion-agente';
import { ErrorApi } from '../http/error-api';
import { IDENTIDAD_AGENTE, type IdentidadAgente } from '../identidad-agente';
import { ConfiguracionModeloRuntime } from '../modelo/configuracion-modelo-runtime';
import { PROMPT_SISTEMA } from '../prompt-sistema';
import { EnsambladorRespuesta, type RespuestaEnsamblada } from './ensamblador-respuesta';
import { type Conversacion, RepositorioConversaciones } from './repositorio-conversaciones';

const LARGO_TITULO = 60;

/** Aviso en español cuando se corta la ejecucion: nunca un corte silencioso (HU-04). */
const AVISO_CORTE: Readonly<Record<'timeout' | 'limite_herramientas', string>> = {
  timeout:
    'No alcancé a terminar dentro del tiempo máximo de procesamiento de esta conversación. Por favor, inicia una conversación nueva.',
  limite_herramientas:
    'Alcancé el máximo de consultas permitidas en esta conversación. Por favor, inicia una conversación nueva.',
};

export interface SolicitudTurno {
  readonly conversacionId: string | null;
  readonly texto: string;
  /** `X-Trace-Id` del ejecutor del experimento; sin el, uno propio de la conversacion. */
  readonly traceId: string | null;
}

/**
 * Coordina UN turno de la persona de principio a fin: registra el texto literal,
 * corre el bucle del agente, ensambla la respuesta del contrato y cierra las
 * mediciones del turno. Si el proveedor falla, la conversacion queda como estaba.
 * Es el mismo codigo en B0 y B1: solo cambia el puerto de capacidades (RNF-01).
 *
 * En el orquestador de B2 y B3 ademas lleva el ciclo de vida de la tarea A2A
 * (docs/03, 3): la confirmacion de un ticket, que en B0/B1 es solo un turno mas,
 * aqui es la transicion `working -> input-required -> working` del protocolo
 * (HU-31). Los estados van a `a2a.estados` de la traza.
 */
@Injectable()
export class AtenderTurnoUseCase {
  constructor(
    @Inject(CONFIGURACION_AGENTE) private readonly configuracion: ConfiguracionAgente,
    @Inject(PROMPT_SISTEMA) private readonly promptSistema: string,
    @Inject(RepositorioConversaciones) private readonly conversaciones: RepositorioConversaciones,
    @Inject(RegistrarTurnoUseCase) private readonly registrarTurno: RegistrarTurnoUseCase,
    @Inject(BucleAgente) private readonly bucle: BucleAgente,
    @Inject(ExtractorObjetoFinal) private readonly extractor: ExtractorObjetoFinal,
    @Inject(EnsambladorRespuesta) private readonly ensamblador: EnsambladorRespuesta,
    @Inject(PresupuestoEjecucion) private readonly presupuesto: PresupuestoEjecucion,
    @Inject(InstrumentadorTrazas) private readonly instrumentador: InstrumentadorTrazas,
    @Inject(ConfiguracionModeloRuntime) private readonly modeloIa: ConfiguracionModeloRuntime,
    @Inject(IDENTIDAD_AGENTE) private readonly identidad: IdentidadAgente,
  ) {}

  async ejecutar(solicitud: SolicitudTurno): Promise<RespuestaMensajeDto> {
    const texto = this.validarTexto(solicitud.texto);
    const conversacion = this.conversacionPara(solicitud);
    const maximos = this.configuracion.limites.turnos;
    const usados = conversacion.mensajes.filter((m) => m.rol === 'usuario').length;
    if (usados >= maximos) {
      throw new ErrorApi(
        'limite-turnos',
        `La conversación alcanzó el máximo de ${maximos} turnos. Inicia una conversación nueva.`,
        { turnosMaximos: maximos },
      );
    }

    const inicioTurno = ahoraMonotonoMs();
    const enviadoEn = new Date();
    // El texto queda registrado ANTES de que el modelo lo vea (DP-05).
    await this.registrarTurno.ejecutar(conversacion.id, texto);
    if (usados === 0) {
      this.registrarEstado(conversacion, 'submitted');
    }
    this.registrarEstado(conversacion, 'working');

    const contexto = {
      traceId: conversacion.traceId,
      conversacionId: conversacion.id,
      actor: this.identidad.actor,
    };
    const historial = [...conversacion.historialModelo, { role: 'user' as const, content: texto }];
    // Con `X-Trace-Id` la peticion viene del ejecutor: manda el modelo de la
    // configuracion, no el que alguien haya elegido en la pantalla (RNF-01).
    const modeloId = this.modeloIa.modeloVigente(solicitud.traceId !== null);
    let resultado: ResultadoBucle;
    // Si el bucle lanza, el motivo se queda en `error_agente`: es lo que el
    // ejecutor necesita para distinguir un fallo de un corte por limite.
    let motivoFin = 'error_agente';
    try {
      resultado = await this.bucle.atender(historial, contexto, inicioTurno, modeloId);
      motivoFin = resultado.motivo;
    } finally {
      const duracion = ahoraMonotonoMs() - inicioTurno;
      this.presupuesto.cerrarTurno(conversacion.traceId, duracion);
      this.instrumentador.cerrarTurno(conversacion.traceId, duracion, motivoFin);
      if (motivoFin !== 'respuesta') {
        this.registrarEstado(conversacion, 'failed');
      }
    }

    const { texto: textoFinal, objeto } =
      resultado.motivo === 'respuesta'
        ? this.extractor.separar(resultado.contenidoFinal ?? '')
        : { texto: AVISO_CORTE[resultado.motivo], objeto: null };
    this.instrumentador.registrarObjetoFinal(
      conversacion.traceId,
      objeto as Record<string, unknown> | null,
    );
    const ensamblada = await this.ensamblador.ensamblar(textoFinal, objeto, resultado.llamadas);
    if (resultado.motivo === 'respuesta') {
      this.registrarEstado(conversacion, estadoFinalDelTurno(ensamblada, objeto?.clasificacion));
      if (objeto !== null) {
        this.registrarArtefactoFinal(conversacion);
      }
    }

    const turno = usados + 1;
    const mensajeUsuario: MensajeUsuarioDto = {
      id: randomUUID(),
      rol: 'usuario',
      turno,
      texto,
      enviadoEn: enviadoEn.toISOString(),
    };
    const respuesta: MensajeAsistenteDto = {
      id: randomUUID(),
      rol: 'asistente',
      turno,
      clasificacion: ensamblada.clasificacion,
      bloques: ensamblada.bloques,
      enviadoEn: new Date().toISOString(),
    };

    conversacion.historialModelo = [...historial, ...resultado.mensajesNuevos];
    conversacion.mensajes = [...conversacion.mensajes, mensajeUsuario, respuesta];
    conversacion.actualizadaEn = new Date();
    this.conversaciones.guardar(conversacion);

    const turnos = { usados: turno, maximos };
    return {
      conversacionId: conversacion.id,
      conversacion: resumen(conversacion, maximos),
      mensajeUsuario,
      respuesta,
      turnos,
      accionSugerida: ensamblada.accionSugerida,
    };
  }

  /** Solo el orquestador lleva una tarea A2A; el agente unico no registra estados (M4.5). */
  private registrarEstado(conversacion: Conversacion, estado: EstadoTareaA2a): void {
    if (this.identidad.rol === 'orquestador') {
      this.instrumentador.registrarEstado(conversacion.traceId, `task-${conversacion.id}`, estado);
    }
  }

  private registrarArtefactoFinal(conversacion: Conversacion): void {
    if (this.identidad.rol === 'orquestador') {
      this.instrumentador.registrarArtefacto(conversacion.traceId, 'resultado_triaje');
    }
  }

  private validarTexto(texto: unknown): string {
    const limpio = typeof texto === 'string' ? texto.trim() : '';
    if (limpio.length < LONGITUD_SOLICITUD.minima || limpio.length > LONGITUD_SOLICITUD.maxima) {
      throw new ErrorApi(
        'validacion',
        `Describe tu solicitud con entre ${LONGITUD_SOLICITUD.minima} y ${LONGITUD_SOLICITUD.maxima} caracteres.`,
        { campo: 'texto' },
      );
    }
    return limpio;
  }

  private conversacionPara(solicitud: SolicitudTurno): Conversacion {
    if (solicitud.conversacionId !== null) {
      const existente = this.conversaciones.obtener(solicitud.conversacionId);
      if (existente === undefined) {
        throw new ErrorApi('no-encontrado', 'La conversación no existe o ya expiró.', {
          conversacionId: solicitud.conversacionId,
        });
      }
      return existente;
    }
    const id = randomUUID();
    const ahora = new Date();
    const titulo = solicitud.texto.trim().replace(/\s+/g, ' ');
    return {
      id,
      titulo: titulo.length > LARGO_TITULO ? `${titulo.slice(0, LARGO_TITULO - 1)}…` : titulo,
      traceId: solicitud.traceId ?? `conv-${id}`,
      creadaEn: ahora,
      actualizadaEn: ahora,
      mensajes: [],
      historialModelo: [{ role: 'system', content: this.promptSistema }],
    };
  }
}

/**
 * Estado A2A en que queda la tarea al cerrar un turno con respuesta (docs/03, 3):
 * `input-required` si el agente propuso un ticket y espera la confirmacion de la
 * persona (HU-31); `rejected` si la solicitud quedo fuera de alcance o fue un
 * intento inseguro; `completed` en cualquier otro caso.
 */
function estadoFinalDelTurno(
  ensamblada: RespuestaEnsamblada,
  clasificacion: string | undefined,
): EstadoTareaA2a {
  if (ensamblada.accionSugerida === 'proponer-ticket') {
    return 'input-required';
  }
  if (clasificacion === 'fuera_de_alcance' || clasificacion === 'adversarial') {
    return 'rejected';
  }
  return 'completed';
}

export function resumen(conversacion: Conversacion, maximos: number): ResumenConversacionDto {
  return {
    id: conversacion.id,
    titulo: conversacion.titulo,
    creadaEn: conversacion.creadaEn.toISOString(),
    actualizadaEn: conversacion.actualizadaEn.toISOString(),
    turnos: {
      usados: conversacion.mensajes.filter((m) => m.rol === 'usuario').length,
      maximos,
    },
  };
}

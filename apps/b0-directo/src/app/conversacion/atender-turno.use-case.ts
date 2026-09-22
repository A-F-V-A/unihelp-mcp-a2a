import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  MensajeAsistenteDto,
  MensajeUsuarioDto,
  RespuestaMensajeDto,
  ResumenConversacionDto,
} from '@unihelp/contratos';
import { LONGITUD_SOLICITUD } from '@unihelp/dominio';
import { PROMPT_BASE, ahoraMonotonoMs } from '@unihelp/herramientas';
import { RegistrarTurnoUseCase } from '@unihelp/tickets';
import { BucleAgente, type ResultadoBucle } from '../agente/bucle-agente';
import { ExtractorObjetoFinal } from '../agente/extractor-objeto-final';
import { InstrumentadorTrazas } from '../agente/instrumentador-trazas';
import { PresupuestoEjecucion } from '../agente/presupuesto-ejecucion';
import { CONFIGURACION_B0, type ConfiguracionB0 } from '../configuracion/configuracion-b0';
import { ErrorApi } from '../http/error-api';
import { EnsambladorRespuesta } from './ensamblador-respuesta';
import { type Conversacion, RepositorioConversaciones } from './repositorio-conversaciones';

/** Actor que queda en la auditoria para todo lo que hace el agente (docs/01, 4.6). */
export const ACTOR_AGENTE_B0 = 'b0-agent';

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
 */
@Injectable()
export class AtenderTurnoUseCase {
  constructor(
    @Inject(CONFIGURACION_B0) private readonly configuracion: ConfiguracionB0,
    @Inject(RepositorioConversaciones) private readonly conversaciones: RepositorioConversaciones,
    @Inject(RegistrarTurnoUseCase) private readonly registrarTurno: RegistrarTurnoUseCase,
    @Inject(BucleAgente) private readonly bucle: BucleAgente,
    @Inject(ExtractorObjetoFinal) private readonly extractor: ExtractorObjetoFinal,
    @Inject(EnsambladorRespuesta) private readonly ensamblador: EnsambladorRespuesta,
    @Inject(PresupuestoEjecucion) private readonly presupuesto: PresupuestoEjecucion,
    @Inject(InstrumentadorTrazas) private readonly instrumentador: InstrumentadorTrazas,
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

    const contexto = {
      traceId: conversacion.traceId,
      conversacionId: conversacion.id,
      actor: ACTOR_AGENTE_B0,
    };
    const historial = [...conversacion.historialModelo, { role: 'user' as const, content: texto }];
    let resultado: ResultadoBucle;
    try {
      resultado = await this.bucle.atender(historial, contexto, inicioTurno);
    } finally {
      const duracion = ahoraMonotonoMs() - inicioTurno;
      this.presupuesto.cerrarTurno(conversacion.traceId, duracion);
      this.instrumentador.cerrarTurno(conversacion.traceId, duracion);
    }

    const { texto: textoFinal, objeto } =
      resultado.motivo === 'respuesta'
        ? this.extractor.separar(resultado.contenidoFinal ?? '')
        : { texto: AVISO_CORTE[resultado.motivo], objeto: null };
    const ensamblada = await this.ensamblador.ensamblar(textoFinal, objeto, resultado.llamadas);

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
      historialModelo: [{ role: 'system', content: PROMPT_BASE }],
    };
  }
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

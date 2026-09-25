import { Injectable, Logger } from '@nestjs/common';
import type {
  A2aTaskDto,
  ArtefactoDiagnosticoDataDto,
  ArtefactoPoliticaAplicableDataDto,
  ArtefactoResultadoTriajeDataDto,
  BloqueRespuestaDto,
  CitaPoliticaDto,
  EstadoServicioDto,
  HistorialConversacionDto,
  MensajeAsistenteDto,
  MensajeDto,
  MensajeUsuarioDto,
  PropuestaTicketDto,
  RespuestaMensajeDto,
  ResumenConversacionDto,
  TicketDto,
} from '@unihelp/contratos';
import type { AreaServicio, Prioridad } from '@unihelp/dominio';
import { ahoraMonotonoMs } from '@unihelp/herramientas';
import { ClienteA2aService } from '../a2a-cliente/cliente-a2a.service';
import { CapacidadesMcpOrquestador } from '../capacidades-mcp/capacidades-mcp-orquestador';
import { ClasificadorService, type TipoSolicitud } from '../clasificador/clasificador.service';
import { RegistroA2aService } from '../registro-a2a/registro-a2a.service';
import { RepositorioTareasService, type TareaEnCurso } from '../tareas/repositorio-tareas.service';

const MAPA_PRIORIDAD: Readonly<Record<string, Prioridad>> = {
  P1: 'critica',
  P2: 'alta',
  P3: 'media',
  P4: 'baja',
  critica: 'critica',
  alta: 'alta',
  media: 'media',
  baja: 'baja',
};

const MAPA_AREA_SERVICIO: Readonly<Record<string, AreaServicio>> = {
  moodle: 'plataforma-virtual',
  aula_virtual: 'plataforma-virtual',
  'aula-virtual': 'plataforma-virtual',
  plataforma_virtual: 'plataforma-virtual',
  'plataforma-virtual': 'plataforma-virtual',
  sia: 'registro-academico',
  matricula: 'registro-academico',
  registro_academico: 'registro-academico',
  'registro-academico': 'registro-academico',
  correo: 'soporte-tecnico',
  soporte_tecnico: 'soporte-tecnico',
  'soporte-tecnico': 'soporte-tecnico',
  vpn: 'soporte-tecnico',
  wifi: 'soporte-tecnico',
  biblioteca: 'biblioteca',
  financiera: 'financiera',
  bienestar: 'bienestar-universitario',
  'bienestar-universitario': 'bienestar-universitario',
  infraestructura: 'infraestructura-fisica',
  'infraestructura-fisica': 'infraestructura-fisica',
};

function normalizarAreaServicio(servicio: string): AreaServicio {
  const clave = servicio.toLowerCase().trim();
  return MAPA_AREA_SERVICIO[clave] ?? 'soporte-tecnico';
}

function normalizarPrioridad(prioridad: string): Prioridad {
  return MAPA_PRIORIDAD[prioridad] ?? 'media';
}

export interface ResultadoTriajeCompleto {
  readonly respuestaMensaje: RespuestaMensajeDto;
  readonly tareaA2a: A2aTaskDto;
  readonly resultadoTriajeData: ArtefactoResultadoTriajeDataDto;
}

/**
 * Servicio de triaje y orquestacion principal de la arquitectura B3 (HU-01 a HU-17, HU-29 a HU-34).
 *
 * Coordina especialistas A2A de forma secuencial (RM-04), gestiona el estado nativo
 * `input-required` para la confirmacion humana de tickets (HU-14, HU-31) e interactua
 * con `mcp-server` con la cabecera `X-Agent-Id: orquestador` (HU-20).
 */
@Injectable()
export class TriajeService {
  private readonly logger = new Logger(TriajeService.name);
  private readonly historialPorConversacion = new Map<string, MensajeDto[]>();
  private readonly turnosPorConversacion = new Map<string, number>();

  constructor(
    private readonly clasificador: ClasificadorService,
    private readonly registroA2a: RegistroA2aService,
    private readonly clienteA2a: ClienteA2aService,
    private readonly capacidadesMcp: CapacidadesMcpOrquestador,
    private readonly repositorioTareas: RepositorioTareasService,
  ) {}

  /**
   * Procesa un turno de conversacion, ya sea una solicitud inicial o una respuesta a una confirmacion.
   */
  async procesarTurno(
    conversacionIdEntrante: string | null,
    texto: string,
    traceIdEntrante?: string | null,
  ): Promise<ResultadoTriajeCompleto> {
    const inicio = ahoraMonotonoMs();
    const conversacionId =
      conversacionIdEntrante ?? `conv-b3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const traceId = traceIdEntrante ?? `trace-b3-${Date.now()}`;
    const turnoActual = (this.turnosPorConversacion.get(conversacionId) ?? 0) + 1;
    this.turnosPorConversacion.set(conversacionId, turnoActual);

    const mensajeUsuario: MensajeUsuarioDto = {
      id: `msg-usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      rol: 'usuario',
      turno: turnoActual,
      texto,
      enviadoEn: new Date().toISOString(),
    };

    this.guardarMensaje(conversacionId, mensajeUsuario);

    // 1. Comprobar si ya existe una tarea esperando confirmacion explicita (HU-14, HU-31)
    let tarea = this.repositorioTareas.obtenerPorConversacionId(conversacionId);

    if (tarea && tarea.estado === 'input-required' && tarea.proposalId) {
      return this.atenderConfirmacion(tarea, mensajeUsuario, conversacionId, traceId, turnoActual);
    }

    // 2. Nueva solicitud: crear tarea en estado 'submitted' -> 'working'
    const taskId = `task-b3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    tarea = this.repositorioTareas.crearTarea(taskId, conversacionId, texto);
    tarea.estado = 'working';

    // 3. Clasificar tipo de solicitud (HU-02)
    const tipo = this.clasificador.clasificar(texto);

    // 4. Delegacion a especialistas secuencialmente (RM-04)
    let resumenTexto = '';
    const bloques: BloqueRespuestaDto[] = [];
    const politicasCitadasCodigos: string[] = [];

    // 4.1 Especialista de Conocimiento
    if (tipo === 'informativa' || tipo === 'compuesta') {
      const cardConocimiento = this.registroA2a.resolverAgentePorHabilidad('knowledge_lookup');
      if (cardConocimiento) {
        tarea.agentesConsultados.push('knowledge_lookup');
        const resA2a = await this.clienteA2a.enviarMensaje(cardConocimiento, texto, traceId, 1);
        if (resA2a && resA2a.task.status === 'completed') {
          const artPolitica = resA2a.task.artifacts.find(
            (a) => a.artifactId === 'politica_aplicable',
          );
          if (artPolitica && artPolitica.parts[0]?.kind === 'data') {
            const data = artPolitica.parts[0].data as ArtefactoPoliticaAplicableDataDto;
            tarea.politicaAplicable = data;

            if (data.politicas && data.politicas.length > 0) {
              const citas: CitaPoliticaDto[] = data.politicas.map((p) => {
                politicasCitadasCodigos.push(p.codigo);
                return {
                  codigo: p.codigo,
                  titulo: p.titulo,
                  version: p.version,
                  extracto: p.extracto,
                  area: 'soporte-tecnico',
                };
              });
              bloques.push({ tipo: 'politicas', politicas: citas });
            }
            resumenTexto += `${data.resumen} `;
          }
        } else {
          tarea.estado = 'failed';
          resumenTexto +=
            'No se pudo consultar la política institucional: especialista no disponible. ';
        }
      }
    }

    // 4.2 Especialista de Diagnóstico
    if ((tipo === 'diagnostico' || tipo === 'compuesta') && tarea.estado !== 'failed') {
      const cardDiagnostico = this.registroA2a.resolverAgentePorHabilidad('incident_diagnosis');
      if (cardDiagnostico) {
        tarea.agentesConsultados.push('incident_diagnosis');
        const resA2a = await this.clienteA2a.enviarMensaje(cardDiagnostico, texto, traceId, 1);
        if (resA2a && resA2a.task.status === 'completed') {
          const artDiag = resA2a.task.artifacts.find((a) => a.artifactId === 'diagnostico');
          if (artDiag && artDiag.parts[0]?.kind === 'data') {
            const data = artDiag.parts[0].data as ArtefactoDiagnosticoDataDto;
            tarea.diagnostico = data;

            const estadoDto: EstadoServicioDto = {
              servicio: normalizarAreaServicio(data.servicio),
              nombre: data.servicio,
              estado:
                data.estado === 'MANTENIMIENTO'
                  ? 'mantenimiento'
                  : data.estado === 'FUERA_DE_SERVICIO'
                    ? 'interrumpido'
                    : data.estado === 'DEGRADADO'
                      ? 'degradado'
                      : 'operativo',
              componenteAfectado: null,
              alcance: data.alcance ?? null,
              ventanaEstimada: null,
              incidenteId: data.incidente_ref ?? null,
              actualizadoEn: new Date().toISOString(),
            };

            if (data.estado === 'MANTENIMIENTO') {
              bloques.push({ tipo: 'aviso-mantenimiento', estado: estadoDto });
            } else {
              bloques.push({ tipo: 'estado-servicio', estado: estadoDto });
            }
            resumenTexto += `${data.justificacion_prioridad}. `;
          }
        } else {
          tarea.estado = 'failed';
          resumenTexto +=
            'No se pudo diagnosticar el estado del servicio: especialista no disponible. ';
        }
      }
    }

    // 5. Evaluar si amerita propuesta de ticket o finalizar
    let accionSugerida: 'proponer-ticket' | null = null;

    if (tarea.estado === 'failed') {
      accionSugerida = null;
    } else if (tarea.diagnostico && tarea.diagnostico.accion_recomendada === 'crear_ticket') {
      // Proponer ticket via MCP con rol orquestador (HU-13, HU-20)
      const resPropuesta = await this.capacidadesMcp.proponerTicket(
        {
          servicio: tarea.diagnostico.servicio,
          categoria: 'rendimiento',
          prioridad: tarea.diagnostico.prioridad_sugerida,
          resumen: `Incidente en ${tarea.diagnostico.servicio}`,
          descripcion: texto,
        },
        traceId,
      );

      tarea.proposalId = resPropuesta.propuesta.proposal_id;
      tarea.resumenPropuesta = resPropuesta.propuesta.resumen;
      tarea.estado = 'input-required'; // HU-31: estado formal de espera humana en A2A
      accionSugerida = 'proponer-ticket';

      const propuestaDto: PropuestaTicketDto = {
        id: resPropuesta.propuesta.proposal_id,
        conversacionId,
        servicio: normalizarAreaServicio(resPropuesta.propuesta.servicio),
        categoria: 'rendimiento',
        prioridad: normalizarPrioridad(resPropuesta.propuesta.prioridad),
        resumen: resPropuesta.propuesta.resumen,
        descripcion: resPropuesta.propuesta.descripcion,
        estado: 'pendiente',
        creadaEn: new Date().toISOString(),
        resueltaEn: null,
        ticketNumero: null,
      };

      bloques.push({ tipo: 'propuesta-ticket', propuesta: propuestaDto });
      resumenTexto += `He preparado una propuesta de ticket con prioridad ${tarea.diagnostico.prioridad_sugerida}. ¿Confirmas la creación del ticket?`;
    } else {
      tarea.estado = 'completed';
      if (!resumenTexto.trim()) {
        resumenTexto =
          'Solicitud atendida. No se detectaron fallas activas ni acciones pendientes.';
      }
    }

    bloques.unshift({ tipo: 'texto', texto: resumenTexto.trim() });

    const durMs = ahoraMonotonoMs() - inicio;
    this.logger.log(`Turno procesado para ${conversacionId} en ${durMs}ms (traceId=${traceId})`);

    return this.construirResultado(
      conversacionId,
      tarea,
      tipo,
      bloques,
      politicasCitadasCodigos,
      accionSugerida,
      mensajeUsuario,
      turnoActual,
      traceId,
    );
  }

  /**
   * Atiende el turno de confirmacion/negacion explicita del usuario (HU-14, HU-15, HU-16).
   */
  private async atenderConfirmacion(
    tarea: TareaEnCurso,
    mensajeUsuario: MensajeUsuarioDto,
    conversacionId: string,
    traceId: string,
    turnoActual: number,
  ): Promise<ResultadoTriajeCompleto> {
    const t = mensajeUsuario.texto.toLowerCase();
    const esAfirmativo =
      t.includes('si') ||
      t.includes('sí') ||
      t.includes('confirmo') ||
      t.includes('adelante') ||
      t.includes('crear') ||
      t.includes('proceder') ||
      t.includes('de acuerdo') ||
      t.includes('ok');

    const bloques: BloqueRespuestaDto[] = [];
    let textoRespuesta = '';

    if (esAfirmativo) {
      tarea.estado = 'working';
      const conf = await this.capacidadesMcp.confirmarPropuesta(
        tarea.proposalId!,
        mensajeUsuario.texto,
        traceId,
      );

      if (conf.confirmacion.aceptada && conf.confirmacion.confirmacion_token) {
        tarea.confirmacionToken = conf.confirmacion.confirmacion_token;
        const resTicket = await this.capacidadesMcp.crearTicketSimulado(
          tarea.proposalId!,
          conf.confirmacion.confirmacion_token,
          traceId,
        );

        const ticketNumero = resTicket.ticket.ticket_id ?? 'UNI-2026-000000';
        tarea.ticketId = ticketNumero;
        tarea.estado = 'completed';

        const ticketDto: TicketDto = {
          numero: ticketNumero,
          propuestaId: tarea.proposalId!,
          conversacionId,
          servicio: normalizarAreaServicio(tarea.diagnostico?.servicio ?? 'soporte-tecnico'),
          categoria: 'rendimiento',
          prioridad: normalizarPrioridad(tarea.diagnostico?.prioridad_sugerida ?? 'P3'),
          estado: 'recibido',
          creadoEn: resTicket.ticket.creado_en ?? new Date().toISOString(),
          atencionEstimada: null,
        };

        bloques.push({ tipo: 'ticket-creado', ticket: ticketDto });
        textoRespuesta = `Confirmación recibida. Se ha generado con éxito el ticket ${ticketDto.numero} con prioridad ${ticketDto.prioridad}.`;
      } else {
        tarea.estado = 'failed';
        textoRespuesta = `No se pudo confirmar la propuesta: ${conf.confirmacion.motivo_rechazo ?? 'Token inválido o expirado'}.`;
      }
    } else {
      tarea.estado = 'completed';
      textoRespuesta =
        'Entendido, he cancelado la creación del ticket. ¿Deseas consultar algo más?';
    }

    bloques.unshift({ tipo: 'texto', texto: textoRespuesta });

    return this.construirResultado(
      conversacionId,
      tarea,
      'compuesta',
      bloques,
      [],
      null,
      mensajeUsuario,
      turnoActual,
      traceId,
    );
  }

  private construirResultado(
    conversacionId: string,
    tarea: TareaEnCurso,
    tipo: TipoSolicitud,
    bloques: readonly BloqueRespuestaDto[],
    politicasCitadasCodigos: readonly string[],
    accionSugerida: 'proponer-ticket' | null,
    mensajeUsuario: MensajeUsuarioDto,
    turnoActual: number,
    traceId: string,
  ): ResultadoTriajeCompleto {
    const mensajeAsistente: MensajeAsistenteDto = {
      id: `msg-ast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      rol: 'asistente',
      turno: turnoActual,
      clasificacion: {
        tipo: tipo === 'fuera_de_alcance' ? 'fuera-de-alcance' : (tipo as any),
        confianza: 0.95,
      },
      bloques,
      enviadoEn: new Date().toISOString(),
    };

    this.guardarMensaje(conversacionId, mensajeAsistente);

    const turnos = { usados: turnoActual, maximos: 8 };

    const resumenConv: ResumenConversacionDto = {
      id: conversacionId,
      titulo: tarea.solicitudOriginal.slice(0, 30),
      creadaEn: new Date(tarea.creadaEn).toISOString(),
      actualizadaEn: new Date().toISOString(),
      turnos,
    };

    const respuestaMensaje: RespuestaMensajeDto = {
      conversacionId,
      conversacion: resumenConv,
      mensajeUsuario,
      respuesta: mensajeAsistente,
      turnos,
      accionSugerida,
    };

    // Estructura A2A del resultado final para evaluacion homogenea del benchmark (HU-30, doc 03 §4.3)
    const resultadoTriajeData: ArtefactoResultadoTriajeDataDto = {
      clasificacion: tipo,
      politicas_citadas: politicasCitadasCodigos,
      diagnostico: tarea.diagnostico
        ? {
            servicio: tarea.diagnostico.servicio,
            prioridad: tarea.diagnostico.prioridad_sugerida,
          }
        : null,
      ticket: {
        creado: Boolean(tarea.ticketId),
        id: tarea.ticketId ?? null,
      },
      confirmacion: {
        solicitada: tarea.estado === 'input-required' || Boolean(tarea.proposalId),
        otorgada: Boolean(tarea.ticketId),
      },
      agentes_consultados: tarea.agentesConsultados,
    };

    const parteTexto = bloques.find((b) => b.tipo === 'texto');
    const textoResumen = parteTexto && 'texto' in parteTexto ? parteTexto.texto : '';

    const tareaA2a: A2aTaskDto = {
      id: tarea.taskId,
      status: tarea.estado,
      messages: [
        {
          role: 'agent',
          parts: [{ kind: 'text', text: textoResumen }],
          metadata: {
            traceId,
            hop: 2,
            emisor: 'b3-a2a-orquestador',
            receptor: 'usuario',
            t_emision: new Date().toISOString(),
          },
        },
      ],
      artifacts: [
        {
          artifactId: 'resultado_triaje',
          parts: [
            { kind: 'text', text: textoResumen },
            { kind: 'data', data: resultadoTriajeData },
          ],
        },
      ],
    };

    return {
      respuestaMensaje,
      tareaA2a,
      resultadoTriajeData,
    };
  }

  obtenerHistorial(conversacionId: string): HistorialConversacionDto {
    const mensajes = this.historialPorConversacion.get(conversacionId) ?? [];
    const turnos = {
      usados: this.turnosPorConversacion.get(conversacionId) ?? 0,
      maximos: 8,
    };
    return { conversacionId, mensajes, turnos };
  }

  listarConversaciones(): readonly ResumenConversacionDto[] {
    const resumenes: ResumenConversacionDto[] = [];
    for (const [id, mensajes] of this.historialPorConversacion.entries()) {
      const turnos = {
        usados: this.turnosPorConversacion.get(id) ?? 0,
        maximos: 8,
      };
      const primerMensaje = mensajes[0];
      const ultimoMensaje = mensajes[mensajes.length - 1];
      resumenes.push({
        id,
        titulo:
          primerMensaje && 'texto' in primerMensaje
            ? primerMensaje.texto.slice(0, 30)
            : 'Conversación',
        creadaEn: primerMensaje?.enviadoEn ?? new Date().toISOString(),
        actualizadaEn: ultimoMensaje?.enviadoEn ?? new Date().toISOString(),
        turnos,
      });
    }
    return resumenes;
  }

  eliminarConversacion(conversacionId: string): void {
    this.historialPorConversacion.delete(conversacionId);
    this.turnosPorConversacion.delete(conversacionId);
  }

  private guardarMensaje(conversacionId: string, mensaje: MensajeDto): void {
    const lista = this.historialPorConversacion.get(conversacionId) ?? [];
    lista.push(mensaje);
    this.historialPorConversacion.set(conversacionId, lista);
  }
}

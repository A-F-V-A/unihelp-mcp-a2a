import { Injectable, Logger } from '@nestjs/common';
import type {
  A2aArtifactDto,
  AccionRecomendadaDiagnostico,
  ArtefactoDiagnosticoDataDto,
} from '@unihelp/contratos';
import { CapacidadesMcpDiagnostico } from '../capacidades-mcp/capacidades-mcp-diagnostico';

/** Servicios universitarios soportados por el triaje. */
export const SERVICIOS_SOPORTADOS = [
  'aula_virtual',
  'correo_institucional',
  'autenticacion',
  'matricula',
] as const;

export type ServicioSoportado = (typeof SERVICIOS_SOPORTADOS)[number];

/**
 * Detecta el servicio universitario a partir del texto en lenguaje natural de los síntomas.
 */
export function detectarServicio(texto: string): ServicioSoportado {
  const t = texto.toLowerCase();
  if (
    t.includes('correo') ||
    t.includes('email') ||
    t.includes('buzon') ||
    t.includes('inbox') ||
    t.includes('mensaje')
  ) {
    return 'correo_institucional';
  }
  if (
    t.includes('matricula') ||
    t.includes('inscripci') ||
    t.includes('asignatura') ||
    t.includes('cupo')
  ) {
    return 'matricula';
  }
  if (
    t.includes('contrase') ||
    t.includes('clave') ||
    t.includes('login') ||
    t.includes('autentica') ||
    t.includes('acceso') ||
    t.includes('cuenta')
  ) {
    return 'autenticacion';
  }
  return 'aula_virtual';
}

/**
 * Servicio que ejecuta la habilidad `incident_diagnosis` para el especialista de diagnostico (HU-09 a HU-12, HU-30).
 *
 * Consulta el estado y componentes del servicio a traves de MCP y calcula la prioridad
 * segun la tabla institucional, devolviendo el artefacto estructurado `diagnostico` (doc 03 §4.2).
 */
@Injectable()
export class IncidentDiagnosisService {
  private readonly logger = new Logger(IncidentDiagnosisService.name);

  constructor(private readonly capacidadesMcp: CapacidadesMcpDiagnostico) {}

  /**
   * Ejecuta el diagnostico del incidente a partir de los sintomas reportados.
   */
  async ejecutarDiagnostico(
    sintomas: string,
    servicioEspecificado?: string,
    traceId?: string,
  ): Promise<{
    artefacto: A2aArtifactDto<ArtefactoDiagnosticoDataDto>;
    durMs: number;
    rttMs: number;
  }> {
    const servicio =
      servicioEspecificado &&
      (SERVICIOS_SOPORTADOS as readonly string[]).includes(servicioEspecificado)
        ? (servicioEspecificado as ServicioSoportado)
        : detectarServicio(sintomas);

    this.logger.log(
      `Consultando estado para servicio «${servicio}» (síntomas: «${sintomas.slice(0, 50)}...»)`,
    );

    const { estado, durMs, rttMs } = await this.capacidadesMcp.consultarEstadoServicio(
      servicio,
      traceId,
    );

    let prioridadSugerida: string;
    let justificacionPrioridad: string;
    let accionRecomendada: AccionRecomendadaDiagnostico;

    // Reglas institucionales de asignacion de prioridad y accion (HU-11, HU-12)
    switch (estado.estado) {
      case 'MANTENIMIENTO':
        prioridadSugerida = 'P4';
        justificacionPrioridad = 'Mantenimiento programado: ventana activa';
        accionRecomendada = 'informar_y_esperar';
        break;
      case 'FUERA_DE_SERVICIO':
        prioridadSugerida = 'P1';
        justificacionPrioridad = 'FUERA_DE_SERVICIO ⇒ P1 según tabla institucional';
        accionRecomendada = 'crear_ticket';
        break;
      case 'DEGRADADO':
        if (estado.alcance === 'total') {
          prioridadSugerida = 'P2';
          justificacionPrioridad = 'DEGRADADO + alcance total ⇒ P2 según tabla institucional';
        } else {
          prioridadSugerida = 'P3';
          justificacionPrioridad = 'DEGRADADO + alcance parcial ⇒ P3 según tabla institucional';
        }
        accionRecomendada = 'crear_ticket';
        break;
      case 'OPERATIVO':
      default:
        prioridadSugerida = 'P4';
        justificacionPrioridad = 'Servicio OPERATIVO sin incidencias publicadas';
        accionRecomendada = 'sin_accion';
        break;
    }

    const data: ArtefactoDiagnosticoDataDto = {
      servicio,
      estado: estado.estado,
      alcance: estado.alcance ?? 'ninguno',
      componentes_afectados: estado.componentes_afectados ?? [],
      sintomas_correlacionados: [sintomas.trim()],
      prioridad_sugerida: prioridadSugerida,
      justificacion_prioridad: justificacionPrioridad,
      accion_recomendada: accionRecomendada,
      incidente_ref: estado.incidente_ref,
    };

    const artefacto: A2aArtifactDto<ArtefactoDiagnosticoDataDto> = {
      artifactId: 'diagnostico',
      name: 'Diagnóstico del incidente',
      parts: [
        {
          kind: 'data',
          data,
        },
      ],
    };

    return {
      artefacto,
      durMs,
      rttMs,
    };
  }
}

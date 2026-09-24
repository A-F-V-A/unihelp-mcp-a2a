import { Injectable, Logger } from '@nestjs/common';
import type {
  ArtefactoDiagnosticoDataDto,
  ArtefactoPoliticaAplicableDataDto,
  EstadoTareaA2a,
} from '@unihelp/contratos';

export interface TareaEnCurso {
  readonly taskId: string;
  readonly conversacionId: string;
  estado: EstadoTareaA2a;
  solicitudOriginal: string;
  politicaAplicable?: ArtefactoPoliticaAplicableDataDto;
  diagnostico?: ArtefactoDiagnosticoDataDto;
  proposalId?: string;
  resumenPropuesta?: string;
  confirmacionToken?: string;
  ticketId?: string;
  agentesConsultados: string[];
  creadaEn: number;
}

/**
 * Repositorio en memoria del estado de las tareas A2A en curso (HU-31, HU-32).
 *
 * Mantiene la correspondencia entre conversacionId y taskId para soportar la transicion
 * `input-required` mientras se espera la confirmacion explicita del usuario (HU-14, HU-31).
 */
@Injectable()
export class RepositorioTareasService {
  private readonly logger = new Logger(RepositorioTareasService.name);
  private readonly porTaskId = new Map<string, TareaEnCurso>();
  private readonly porConversacionId = new Map<string, string>();

  crearTarea(taskId: string, conversacionId: string, solicitudOriginal: string): TareaEnCurso {
    const tarea: TareaEnCurso = {
      taskId,
      conversacionId,
      estado: 'submitted',
      solicitudOriginal,
      agentesConsultados: [],
      creadaEn: Date.now(),
    };
    this.porTaskId.set(taskId, tarea);
    this.porConversacionId.set(conversacionId, taskId);
    return tarea;
  }

  obtenerPorTaskId(taskId: string): TareaEnCurso | undefined {
    return this.porTaskId.get(taskId);
  }

  obtenerPorConversacionId(conversacionId: string): TareaEnCurso | undefined {
    const taskId = this.porConversacionId.get(conversacionId);
    if (!taskId) return undefined;
    return this.porTaskId.get(taskId);
  }

  actualizarEstado(taskId: string, estado: EstadoTareaA2a): void {
    const tarea = this.porTaskId.get(taskId);
    if (tarea) {
      tarea.estado = estado;
      this.logger.log(`Tarea «${taskId}» transicionó a estado «${estado}»`);
    }
  }

  eliminar(taskId: string): void {
    const tarea = this.porTaskId.get(taskId);
    if (tarea) {
      this.porConversacionId.delete(tarea.conversacionId);
      this.porTaskId.delete(taskId);
    }
  }
}

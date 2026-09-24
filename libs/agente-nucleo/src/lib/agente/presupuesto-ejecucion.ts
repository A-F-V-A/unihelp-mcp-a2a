import { Inject, Injectable } from '@nestjs/common';
import { ahoraMonotonoMs } from '@unihelp/herramientas';
import {
  CONFIGURACION_AGENTE,
  type ConfiguracionAgente,
} from '../configuracion/configuracion-agente';

/**
 * Presupuesto de tiempo de una conversacion (RNF-04). Cuenta solo el tiempo de
 * procesamiento: la espera entre turnos (por ejemplo, mientras la persona decide
 * si confirma) no consume presupuesto, igual que en M4.1. El limite de llamadas
 * a herramientas lo aplica el receptor (`EjecutorCapacidad`), como en B1.
 */
@Injectable()
export class PresupuestoEjecucion {
  private readonly consumido = new Map<string, number>();

  constructor(@Inject(CONFIGURACION_AGENTE) private readonly configuracion: ConfiguracionAgente) {}

  /** Milisegundos que quedan, contando el turno en curso desde `inicioTurno` (monotono). */
  restanteMs(traceId: string, inicioTurno: number): number {
    const enCurso = ahoraMonotonoMs() - inicioTurno;
    return this.configuracion.limites.tiempoMs - (this.consumido.get(traceId) ?? 0) - enCurso;
  }

  /** Suma la duracion de un turno terminado. */
  cerrarTurno(traceId: string, duracionMs: number): void {
    this.consumido.set(traceId, (this.consumido.get(traceId) ?? 0) + duracionMs);
  }

  olvidar(traceId: string): void {
    this.consumido.delete(traceId);
  }
}

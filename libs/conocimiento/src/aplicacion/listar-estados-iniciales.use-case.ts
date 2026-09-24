import { Inject, Injectable } from '@nestjs/common';
import { compararTexto } from '../dominio/reglas/estado-canonico.rules';
import type { SemillaConocimiento } from '../dominio/semilla';
import { SEMILLA_CONOCIMIENTO } from './tokens';

/** Una variante del entorno, con los sistemas que deja afectados. */
export interface EstadoInicialDisponible {
  readonly codigo: string;
  readonly descripcion: string;
  /** Codigos de servicio afectados, en orden binario (RM-10). Vacio en `todo_operativo`. */
  readonly serviciosAfectados: readonly string[];
}

/**
 * Lista los estados iniciales que define la semilla (docs/10, seccion 4), sin
 * tocar la base: responde aunque PostgreSQL este vacio o apagado. Es el catalogo
 * de lo que se puede pedir a `RestablecerConocimientoUseCase`.
 *
 * Ordenado por codigo en orden binario (RM-10), no por orden de aparicion en el
 * archivo: el archivo se edita a mano y su orden no es un criterio.
 */
@Injectable()
export class ListarEstadosInicialesUseCase {
  constructor(@Inject(SEMILLA_CONOCIMIENTO) private readonly semilla: SemillaConocimiento) {}

  ejecutar(): readonly EstadoInicialDisponible[] {
    return [...this.semilla.estadosIniciales]
      .sort((a, b) => compararTexto(a.codigo, b.codigo))
      .map((estado) => ({
        codigo: estado.codigo,
        descripcion: estado.descripcion,
        serviciosAfectados: [...estado.afectaciones]
          .map((afectacion) => afectacion.servicio)
          .sort(compararTexto),
      }));
  }
}

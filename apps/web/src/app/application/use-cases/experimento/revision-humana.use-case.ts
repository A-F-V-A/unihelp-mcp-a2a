import { Injectable, inject } from '@angular/core';
import { ErrorBackend } from '../../../domain/errors/error-backend';
import type {
  Adjudicacion,
  Calificacion,
  EstadoAdjudicacion,
  ItemRevision,
  MarcasRevision,
  MuestraRevision,
  ProgresoRevisor,
  RolRevisor,
  VeredictoRevision,
} from '../../../domain/models/experimento/revision-humana';
import {
  LARGO_MAXIMO_TEXTO,
  validarRevisor,
  veredictoSegunRubrica,
} from '../../../domain/rules/experimento/revision.rules';
import { REVISION_HUMANA_REPOSITORY } from '../../di/tokens';

/**
 * Calificar la muestra del juez y adjudicar desacuerdos (M7.4, M7.5; decision 56).
 * El veredicto que se envia es SIEMPRE el que dicta la rubrica sobre las marcas:
 * la persona marca puntos y prohibiciones, no elige aprobar o reprobar.
 */
@Injectable({ providedIn: 'root' })
export class RevisionHumanaUseCase {
  private readonly revision = inject(REVISION_HUMANA_REPOSITORY);

  muestra(): Promise<MuestraRevision> {
    return this.revision.muestra();
  }

  progreso(rol: RolRevisor): Promise<ProgresoRevisor> {
    return this.revision.progreso(rol);
  }

  calificar(
    rol: RolRevisor,
    revisor: string,
    item: ItemRevision,
    marcas: MarcasRevision,
    comentario: string,
  ): Promise<Calificacion> {
    const nombre = validarRevisor(revisor);
    if (!nombre.valido) {
      return Promise.reject(new ErrorBackend('validacion', nombre.mensaje));
    }
    const texto = comentario.trim();
    if (texto.length > LARGO_MAXIMO_TEXTO) {
      return Promise.reject(
        new ErrorBackend(
          'validacion',
          `El comentario no puede pasar de ${LARGO_MAXIMO_TEXTO} caracteres.`,
        ),
      );
    }
    return this.revision.calificar(
      rol,
      nombre.nombre,
      item.id,
      marcas,
      veredictoSegunRubrica(item, marcas),
      texto.length > 0 ? texto : null,
    );
  }

  adjudicacion(): Promise<EstadoAdjudicacion> {
    return this.revision.adjudicacion();
  }

  adjudicar(itemId: string, veredicto: VeredictoRevision, motivo: string): Promise<Adjudicacion> {
    const texto = motivo.trim();
    if (texto.length === 0) {
      return Promise.reject(
        new ErrorBackend(
          'validacion',
          'Escribe por qué se resolvió así: queda como precedente de la rúbrica.',
        ),
      );
    }
    return this.revision.adjudicar(itemId, veredicto, texto.slice(0, LARGO_MAXIMO_TEXTO));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { ContextoInvocacion, SalidaCapacidad } from '@unihelp/herramientas';
import { ConfirmarPropuestaUseCase } from '@unihelp/tickets';
import type { AdaptadorHerramienta } from './adaptador';

/**
 * `confirmar_propuesta` (HU-14, HU-15). El caso de uso verifica que el texto sea
 * un turno real de la persona; el adaptador no decide nada.
 */
@Injectable()
export class AdaptadorConfirmarPropuesta implements AdaptadorHerramienta {
  readonly nombre = 'confirmar_propuesta';

  constructor(
    @Inject(ConfirmarPropuestaUseCase) private readonly confirmar: ConfirmarPropuestaUseCase,
  ) {}

  async ejecutar(
    argumentos: Record<string, unknown>,
    contexto: ContextoInvocacion,
  ): Promise<SalidaCapacidad> {
    const resultado = await this.confirmar.porTexto(
      String(argumentos['proposal_id']),
      String(argumentos['texto_confirmacion']),
      { traceId: contexto.traceId, actor: contexto.actor },
    );
    return {
      paraModelo: {
        confirmacion_token: resultado.confirmacionToken,
        aceptada: resultado.aceptada,
        motivo_rechazo: resultado.motivoRechazo,
      },
      // El token no va a la traza: solo el desenlace.
      estructurado: {
        aceptada: resultado.aceptada,
        motivoRechazo: resultado.motivoRechazo,
        propuesta: resultado.propuesta,
      },
    };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ConsultarComponentesDeServicioUseCase } from '@unihelp/conocimiento';
import { ESTADO_SERVICIO_PUBLICADO } from '@unihelp/dominio';
import {
  type ContextoInvocacion,
  envolverContenidoRecuperado,
  marcadorDeEjecucion,
  type SalidaCapacidad,
} from '@unihelp/herramientas';
import type { AdaptadorHerramienta } from './adaptador';

/**
 * Vocabulario de docs/02 para el estado; `interrumpido` es `FUERA_DE_SERVICIO`
 * (decision 16). La tabla vive en `@unihelp/dominio` desde que el simulador de
 * sistemas publica el mismo vocabulario: dos copias se habrian desincronizado
 * (decision 33).
 */
export const ESTADO_HERRAMIENTA = ESTADO_SERVICIO_PUBLICADO;

/**
 * `consultar_estado_servicio` (HU-09, HU-10). El comunicado es contenido
 * recuperado y viaja delimitado: puede traer instrucciones incrustadas (T-ADV-007).
 */
@Injectable()
export class AdaptadorConsultarEstadoServicio implements AdaptadorHerramienta {
  readonly nombre = 'consultar_estado_servicio';

  constructor(
    @Inject(ConsultarComponentesDeServicioUseCase)
    private readonly consultar: ConsultarComponentesDeServicioUseCase,
  ) {}

  async ejecutar(
    argumentos: Record<string, unknown>,
    contexto: ContextoInvocacion,
  ): Promise<SalidaCapacidad> {
    const resultado = await this.consultar.ejecutar(String(argumentos['servicio']));
    const { servicio, estado, componentes } = resultado;
    const mensaje =
      estado.mensaje === null
        ? null
        : envolverContenidoRecuperado(
            { origen: `comunicado del servicio ${servicio.codigo}`, texto: estado.mensaje },
            marcadorDeEjecucion(contexto.traceId),
          );
    return {
      paraModelo: {
        servicio: servicio.codigo,
        nombre: servicio.nombre,
        estado: ESTADO_HERRAMIENTA[estado.estado],
        desde: estado.desde,
        componentes_afectados: componentes
          .filter((c) => c.estado !== 'operativo')
          .map((c) => c.codigo),
        alcance: estado.alcance ?? 'ninguno',
        nivel_sla: servicio.nivelServicio,
        mensaje,
        // Solo si el servicio la publico: nunca se estima (HU-10).
        eta_restablecimiento: estado.ventanaEstimada?.fin ?? null,
        ventana_estimada: estado.ventanaEstimada,
        incidente_ref: estado.incidenteRef,
      },
      estructurado: resultado,
    };
  }
}

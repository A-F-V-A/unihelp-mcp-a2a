import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { comoTrasViajar } from '@unihelp/capacidades';
import type { HabilidadA2a } from '@unihelp/contratos';
import { ahoraMonotonoMs } from '@unihelp/herramientas';
import {
  type AgenteEspecialista,
  ESPECIALISTA_DE_HABILIDAD,
  type PuertoEspecialistas,
  type ResultadoDelegacion,
  type SolicitudDelegacion,
} from '@unihelp/multiagente-nucleo';

/** Los dos especialistas, ya construidos con su cliente del modelo y su cliente MCP. */
export const ESPECIALISTAS_LOCALES = Symbol('ESPECIALISTAS_LOCALES');

/**
 * Implementacion EN PROCESO del puerto de especialistas: la UNICA pieza de B2
 * que no es el nucleo multiagente compartido, y la unica diferencia con B3
 * (H3, RNF-01; decision 44). Es el equivalente exacto del cliente A2A de B3:
 * aqui la solicitud no sale del proceso.
 *
 * La tarea del especialista pasa por JSON (`comoTrasViajar`) para que el
 * orquestador vea EXACTAMENTE la misma forma que en B3, donde llega
 * serializada; y la ida y vuelta se mide igual que en B3, aunque en B2 sea
 * casi la duracion del receptor: el transporte nunca se fija en cero (M4.2, D5).
 * Cada delegacion cuenta como un mensaje de ida y uno de vuelta, como en B3,
 * para que M4.5 compare lo mismo en ambas.
 */
@Injectable()
export class EspecialistasEnProceso implements PuertoEspecialistas, OnModuleDestroy {
  private readonly logger = new Logger('EspecialistasEnProceso');

  constructor(
    @Inject(ESPECIALISTAS_LOCALES)
    private readonly especialistas: ReadonlyMap<HabilidadA2a, AgenteEspecialista>,
  ) {}

  async delegar(solicitud: SolicitudDelegacion): Promise<ResultadoDelegacion> {
    const especialista = this.especialistas.get(solicitud.habilidad);
    if (especialista === undefined) {
      // No puede pasar con los dos especialistas cableados; si pasa, es un
      // defecto de configuracion y no de la arquitectura.
      throw new Error(
        `No hay ningún especialista en proceso para «${solicitud.habilidad}» (${ESPECIALISTA_DE_HABILIDAD[solicitud.habilidad]}).`,
      );
    }
    const tEmision = new Date().toISOString();
    const inicio = ahoraMonotonoMs();
    const tarea = comoTrasViajar(
      await especialista.atender({
        habilidad: solicitud.habilidad,
        entrada: comoTrasViajar(solicitud.entrada),
        traceId: solicitud.traceId,
        conversacionId: solicitud.conversacionId,
        tiempoRestanteMs: solicitud.tiempoRestanteMs,
        hop: 1,
      }),
    );
    const rttMs = ahoraMonotonoMs() - inicio;
    const tRecepcion = new Date().toISOString();
    this.logger.log(
      `${solicitud.habilidad} -> ${especialista.rol}: ${tarea.status} en ${rttMs.toFixed(1)} ms (traza ${solicitud.traceId})`,
    );
    return { tarea, rttMs, tEmision, tRecepcion };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.especialistas.values()].map((e) => e.onModuleDestroy()));
  }
}

import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import {
  CHAT_REPOSITORY,
  CONSOLA_EXPERIMENTO_REPOSITORY,
  EXPERIMENTO_REPOSITORY,
  MODELO_IA_REPOSITORY,
  POLITICA_REPOSITORY,
  PREFERENCIAS_REPOSITORY,
  SERVICIO_REPOSITORY,
  SESION_CONVERSACION,
  TICKET_REPOSITORY,
} from '../application/di/tokens';
import { PreferenciasNavegador } from './browser/preferencias.navegador';
import { SesionConversacionNavegador } from './browser/sesion-conversacion.navegador';
import { EstaticosExperimentoRepository } from './estaticos/estaticos-experimento.repository';
import { ClienteApi } from './http/cliente-api';
import { HttpChatRepository } from './http/http-chat.repository';
import { HttpConsolaExperimentoRepository } from './http/http-consola-experimento.repository';
import { HttpModeloIaRepository } from './http/http-modelo-ia.repository';
import { HttpPoliticaRepository } from './http/http-politica.repository';
import { HttpServicioRepository } from './http/http-servicio.repository';
import { HttpTicketRepository } from './http/http-ticket.repository';

/**
 * UNICO punto donde cada puerto se enlaza con su implementacion. Todos hablan
 * HTTP contra el `backendUrl` resuelto en ejecucion: la capa de datos simulada
 * se retiro cuando B0 paso a responder el contrato completo (decision 28).
 *
 * Las excepciones son las del panel del experimento: lee archivos estaticos del
 * mismo origen (decision 38) y lanza corridas contra la consola local en
 * `consolaUrl` (decision 39), nunca contra la API del backend.
 */
export function provideDataLayer(): EnvironmentProviders {
  const proveedores: Provider[] = [
    ClienteApi,
    HttpChatRepository,
    HttpTicketRepository,
    HttpPoliticaRepository,
    HttpServicioRepository,
    HttpModeloIaRepository,
    EstaticosExperimentoRepository,
    HttpConsolaExperimentoRepository,

    { provide: CHAT_REPOSITORY, useExisting: HttpChatRepository },
    { provide: TICKET_REPOSITORY, useExisting: HttpTicketRepository },
    { provide: POLITICA_REPOSITORY, useExisting: HttpPoliticaRepository },
    { provide: SERVICIO_REPOSITORY, useExisting: HttpServicioRepository },
    { provide: MODELO_IA_REPOSITORY, useExisting: HttpModeloIaRepository },
    { provide: EXPERIMENTO_REPOSITORY, useExisting: EstaticosExperimentoRepository },
    { provide: CONSOLA_EXPERIMENTO_REPOSITORY, useExisting: HttpConsolaExperimentoRepository },

    { provide: SESION_CONVERSACION, useClass: SesionConversacionNavegador },
    { provide: PREFERENCIAS_REPOSITORY, useClass: PreferenciasNavegador },
  ];
  return makeEnvironmentProviders(proveedores);
}

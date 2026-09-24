import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import {
  CHAT_REPOSITORY,
  MODELO_IA_REPOSITORY,
  POLITICA_REPOSITORY,
  PREFERENCIAS_REPOSITORY,
  SERVICIO_REPOSITORY,
  SESION_CONVERSACION,
  TICKET_REPOSITORY,
} from '../application/di/tokens';
import { PreferenciasNavegador } from './browser/preferencias.navegador';
import { SesionConversacionNavegador } from './browser/sesion-conversacion.navegador';
import { ClienteApi } from './http/cliente-api';
import { HttpChatRepository } from './http/http-chat.repository';
import { HttpModeloIaRepository } from './http/http-modelo-ia.repository';
import { HttpPoliticaRepository } from './http/http-politica.repository';
import { HttpServicioRepository } from './http/http-servicio.repository';
import { HttpTicketRepository } from './http/http-ticket.repository';

/**
 * UNICO punto donde cada puerto se enlaza con su implementacion. Todos hablan
 * HTTP contra el `backendUrl` resuelto en ejecucion: la capa de datos simulada
 * se retiro cuando B0 paso a responder el contrato completo (decision 29).
 */
export function provideDataLayer(): EnvironmentProviders {
  const proveedores: Provider[] = [
    ClienteApi,
    HttpChatRepository,
    HttpTicketRepository,
    HttpPoliticaRepository,
    HttpServicioRepository,
    HttpModeloIaRepository,

    { provide: CHAT_REPOSITORY, useExisting: HttpChatRepository },
    { provide: TICKET_REPOSITORY, useExisting: HttpTicketRepository },
    { provide: POLITICA_REPOSITORY, useExisting: HttpPoliticaRepository },
    { provide: SERVICIO_REPOSITORY, useExisting: HttpServicioRepository },
    { provide: MODELO_IA_REPOSITORY, useExisting: HttpModeloIaRepository },

    { provide: SESION_CONVERSACION, useClass: SesionConversacionNavegador },
    { provide: PREFERENCIAS_REPOSITORY, useClass: PreferenciasNavegador },
  ];
  return makeEnvironmentProviders(proveedores);
}

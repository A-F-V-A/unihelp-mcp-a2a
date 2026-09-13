import {
  type EnvironmentProviders,
  InjectionToken,
  type Provider,
  type Type,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import {
  CHAT_REPOSITORY,
  POLITICA_REPOSITORY,
  PREFERENCIAS_REPOSITORY,
  PROVEEDOR_IA_REPOSITORY,
  SERVICIO_REPOSITORY,
  SESION_CONVERSACION,
  TICKET_REPOSITORY,
} from '../application/di/tokens';
import { PreferenciasNavegador } from './browser/preferencias.navegador';
import { ProveedorIANavegador } from './browser/proveedor-ia.navegador';
import { SesionConversacionNavegador } from './browser/sesion-conversacion.navegador';
import { ClienteApi } from './http/cliente-api';
import { HttpChatRepository } from './http/http-chat.repository';
import { HttpPoliticaRepository } from './http/http-politica.repository';
import { HttpServicioRepository } from './http/http-servicio.repository';
import { HttpTicketRepository } from './http/http-ticket.repository';
import { BaseDatosSimulada } from './mock/base-datos-simulada';
import {
  CONFIGURACION_SIMULACION,
  type ConfiguracionSimulacion,
  crearConfiguracionSimulacion,
} from './mock/configuracion-simulacion';
import { MockChatRepository } from './mock/mock-chat.repository';
import { MockPoliticaRepository } from './mock/mock-politica.repository';
import { MockServicioRepository } from './mock/mock-servicio.repository';
import { MockTicketRepository } from './mock/mock-ticket.repository';
import { SimuladorRed } from './mock/simulador-red';

/** `true`: repositorios simulados. `false`: repositorios HTTP contra `backendUrl`. */
export const USE_MOCK_BACKEND = new InjectionToken<boolean>('USE_MOCK_BACKEND');

export interface OpcionesCapaDatos {
  readonly useMockBackend: boolean;
  /** Ajustes de la simulacion; se ignoran con el backend real. */
  readonly simulacion?: Partial<ConfiguracionSimulacion>;
}

/**
 * Asocia el token de un puerto a la implementacion elegida por
 * `USE_MOCK_BACKEND`. Solo se instancia la implementacion elegida.
 */
function segunBackend<T>(token: InjectionToken<T>, simulado: Type<T>, real: Type<T>): Provider {
  return {
    provide: token,
    useFactory: () => (inject(USE_MOCK_BACKEND) ? inject(simulado) : inject(real)),
  };
}

/**
 * UNICO punto de la aplicacion que sabe si hay backend real o simulado.
 * Componentes, store y casos de uso inyectan los tokens de los puertos.
 */
export function provideDataLayer(opciones: OpcionesCapaDatos): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: USE_MOCK_BACKEND, useValue: opciones.useMockBackend },
    {
      provide: CONFIGURACION_SIMULACION,
      useFactory: () =>
        crearConfiguracionSimulacion(opciones.simulacion, globalThis.location?.search ?? ''),
    },

    ClienteApi,
    HttpChatRepository,
    HttpTicketRepository,
    HttpPoliticaRepository,
    HttpServicioRepository,

    SimuladorRed,
    BaseDatosSimulada,
    MockChatRepository,
    MockTicketRepository,
    MockPoliticaRepository,
    MockServicioRepository,

    segunBackend(CHAT_REPOSITORY, MockChatRepository, HttpChatRepository),
    segunBackend(TICKET_REPOSITORY, MockTicketRepository, HttpTicketRepository),
    segunBackend(POLITICA_REPOSITORY, MockPoliticaRepository, HttpPoliticaRepository),
    segunBackend(SERVICIO_REPOSITORY, MockServicioRepository, HttpServicioRepository),

    { provide: SESION_CONVERSACION, useClass: SesionConversacionNavegador },
    { provide: PREFERENCIAS_REPOSITORY, useClass: PreferenciasNavegador },
    { provide: PROVEEDOR_IA_REPOSITORY, useClass: ProveedorIANavegador },

    provideEnvironmentInitializer(() => {
      if (inject(USE_MOCK_BACKEND)) {
        console.info('[UniHelp] Capa de datos SIMULADA: ninguna petición sale al backend.');
      }
    }),
  ]);
}

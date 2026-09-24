import { InjectionToken } from '@angular/core';
import type { ChatRepository } from '../../domain/ports/chat.repository';
import type { ConsolaExperimentoRepository } from '../../domain/ports/consola-experimento.repository';
import type { ExperimentoRepository } from '../../domain/ports/experimento.repository';
import type { PoliticaRepository } from '../../domain/ports/politica.repository';
import type { PreferenciasRepository } from '../../domain/ports/preferencias.repository';
import type { ModeloIaRepository } from '../../domain/ports/modelo-ia.repository';
import type { ServicioRepository } from '../../domain/ports/servicio.repository';
import type { SesionConversacionPort } from '../../domain/ports/sesion-conversacion.port';
import type { TicketRepository } from '../../domain/ports/ticket.repository';

/*
 * Los puertos son interfaces (no existen en runtime), asi que Angular necesita
 * un token para inyectarlos. Casos de uso y store dependen SOLO de estos
 * tokens; que implementacion hay detras lo decide `provideDataLayer()`.
 */

export const CHAT_REPOSITORY = new InjectionToken<ChatRepository>('CHAT_REPOSITORY');

export const TICKET_REPOSITORY = new InjectionToken<TicketRepository>('TICKET_REPOSITORY');

export const POLITICA_REPOSITORY = new InjectionToken<PoliticaRepository>('POLITICA_REPOSITORY');

export const SERVICIO_REPOSITORY = new InjectionToken<ServicioRepository>('SERVICIO_REPOSITORY');

export const PREFERENCIAS_REPOSITORY = new InjectionToken<PreferenciasRepository>(
  'PREFERENCIAS_REPOSITORY',
);

export const MODELO_IA_REPOSITORY = new InjectionToken<ModeloIaRepository>('MODELO_IA_REPOSITORY');

export const SESION_CONVERSACION = new InjectionToken<SesionConversacionPort>(
  'SESION_CONVERSACION',
);

/** Panel del experimento: solo lectura de archivos estaticos (HU-MET-14). */
export const EXPERIMENTO_REPOSITORY = new InjectionToken<ExperimentoRepository>(
  'EXPERIMENTO_REPOSITORY',
);

/** Consola del experimento: lo unico que lanza corridas desde el panel (decision 39). */
export const CONSOLA_EXPERIMENTO_REPOSITORY = new InjectionToken<ConsolaExperimentoRepository>(
  'CONSOLA_EXPERIMENTO_REPOSITORY',
);

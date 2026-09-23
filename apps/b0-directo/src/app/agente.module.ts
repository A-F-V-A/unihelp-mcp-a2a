import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConocimientoModule, perfilPermiteRestablecer } from '@unihelp/conocimiento';
import { EjecutorCapacidad, ValidadorArgumentos } from '@unihelp/herramientas';
import { perfilPermiteVaciarTickets, RegistroAuditoria, TicketsModule } from '@unihelp/tickets';
import { BucleAgente } from './agente/bucle-agente';
import { ExtractorObjetoFinal } from './agente/extractor-objeto-final';
import { InstrumentadorTrazas } from './agente/instrumentador-trazas';
import { PresupuestoEjecucion } from './agente/presupuesto-ejecucion';
import {
  CONFIGURACION_B0,
  type ConfiguracionB0,
  leerConfiguracionB0,
} from './configuracion/configuracion-b0';
import { ConsultasController } from './consultas/consultas.controller';
import { AtenderTurnoUseCase } from './conversacion/atender-turno.use-case';
import { ConversacionController } from './conversacion/conversacion.controller';
import { EnsambladorRespuesta } from './conversacion/ensamblador-respuesta';
import { RepositorioConversaciones } from './conversacion/repositorio-conversaciones';
import { ExperimentoController } from './experimento/experimento.controller';
import { AdaptadorBuscarPolitica } from './herramientas/adaptadores/buscar-politica.adaptador';
import { AdaptadorConfirmarPropuesta } from './herramientas/adaptadores/confirmar-propuesta.adaptador';
import { AdaptadorConsultarEstadoServicio } from './herramientas/adaptadores/consultar-estado-servicio.adaptador';
import { AdaptadorCrearTicketSimulado } from './herramientas/adaptadores/crear-ticket-simulado.adaptador';
import { AdaptadorProponerTicket } from './herramientas/adaptadores/proponer-ticket.adaptador';
import { traducirFalloCapacidad } from './herramientas/adaptadores/traducir-fallo';
import { CatalogoServicios } from './herramientas/catalogo-servicios';
import { RegistroCapacidades } from './herramientas/registro-capacidades';
import { TransporteHerramientasLocal } from './herramientas/transporte-herramientas-local';
import { FiltroErrores } from './http/filtro-errores';
import { CaseteModelo } from './modelo/casete-modelo';
import { ConfiguracionModeloRuntime } from './modelo/configuracion-modelo-runtime';
import { ModeloIaController } from './modelo/modelo-ia.controller';
import { ClienteModelo } from './modelo/cliente-modelo';
import { TicketsController } from './tickets/tickets.controller';

/**
 * El agente unico de B0 con sus cinco herramientas EN PROCESO: la invocacion
 * que el modelo pide termina en un adaptador local, sin protocolo intermedio.
 * La configuracion se lee al arrancar y un valor faltante detiene el arranque.
 * Arquitectura completa en `apps/b0-directo/docs/ARQUITECTURA.md`.
 */
@Module({})
export class AgenteModule {
  static forRoot(
    configuracion: ConfiguracionB0 = leerConfiguracionB0(),
    entorno: Readonly<Record<string, string | undefined>> = process.env,
  ): DynamicModule {
    // Las rutas del ejecutor solo existen en el perfil de experimento: fuera de
    // el, restablecer borraria una base real y el controlador ni se registra
    // (decision 32). Se exigen los dos restablecimientos porque una ejecucion
    // con el conocimiento restablecido y los tickets de la anterior no sirve.
    const perfilDeExperimento =
      perfilPermiteRestablecer(entorno) && perfilPermiteVaciarTickets(entorno);
    return {
      module: AgenteModule,
      imports: [ConocimientoModule.forRoot(), TicketsModule.forRoot()],
      controllers: [
        ConversacionController,
        TicketsController,
        ConsultasController,
        ModeloIaController,
        ...(perfilDeExperimento ? [ExperimentoController] : []),
      ],
      providers: [
        { provide: CONFIGURACION_B0, useValue: configuracion },
        { provide: APP_FILTER, useClass: FiltroErrores },
        {
          provide: EjecutorCapacidad,
          useFactory: (auditoria: RegistroAuditoria) =>
            new EjecutorCapacidad(
              new ValidadorArgumentos(),
              auditoria,
              configuracion.limites.llamadasHerramienta,
              traducirFalloCapacidad,
            ),
          inject: [RegistroAuditoria],
        },
        CaseteModelo,
        ClienteModelo,
        ConfiguracionModeloRuntime,
        CatalogoServicios,
        AdaptadorBuscarPolitica,
        AdaptadorConsultarEstadoServicio,
        AdaptadorProponerTicket,
        AdaptadorConfirmarPropuesta,
        AdaptadorCrearTicketSimulado,
        RegistroCapacidades,
        TransporteHerramientasLocal,
        PresupuestoEjecucion,
        InstrumentadorTrazas,
        ExtractorObjetoFinal,
        BucleAgente,
        EnsambladorRespuesta,
        RepositorioConversaciones,
        AtenderTurnoUseCase,
      ],
    };
  }
}

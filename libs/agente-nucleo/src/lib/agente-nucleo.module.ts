import { Module } from '@nestjs/common';
import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { IdentidadServicio } from '@unihelp/contratos';
import { perfilPermiteRestablecer } from '@unihelp/conocimiento';
import type { ProtocoloIntegracion } from '@unihelp/dominio';
import { PROMPT_BASE } from '@unihelp/herramientas';
import { perfilPermiteVaciarTickets } from '@unihelp/tickets';
import { BucleAgente } from './agente/bucle-agente';
import { ExtractorObjetoFinal } from './agente/extractor-objeto-final';
import { InstrumentadorTrazas } from './agente/instrumentador-trazas';
import { PresupuestoEjecucion } from './agente/presupuesto-ejecucion';
import { CatalogoServicios } from './catalogo/catalogo-servicios';
import {
  CONFIGURACION_AGENTE,
  type ConfiguracionAgente,
  leerConfiguracionAgente,
} from './configuracion/configuracion-agente';
import { ConsultasController } from './consultas/consultas.controller';
import { AtenderTurnoUseCase } from './conversacion/atender-turno.use-case';
import { ConversacionController } from './conversacion/conversacion.controller';
import { EnsambladorRespuesta } from './conversacion/ensamblador-respuesta';
import { RepositorioConversaciones } from './conversacion/repositorio-conversaciones';
import { ExperimentoController } from './experimento/experimento.controller';
import { FiltroErrores } from './http/filtro-errores';
import { IDENTIDAD_AGENTE, identidadAgenteDe } from './identidad-agente';
import { CaseteModelo } from './modelo/casete-modelo';
import { ClienteModelo } from './modelo/cliente-modelo';
import { ConfiguracionModeloRuntime } from './modelo/configuracion-modelo-runtime';
import { ModeloIaController } from './modelo/modelo-ia.controller';
import { PROMPT_SISTEMA } from './prompt-sistema';
import { TicketsController } from './tickets/tickets.controller';

export interface OpcionesAgenteNucleo {
  /** Identidad de salud de la app; de ella se deriva el actor de auditoria y las etiquetas de la traza. */
  readonly identidad: IdentidadServicio;
  /**
   * Modulos de la arquitectura. Deben exportar la implementacion del puerto y
   * los casos de uso de `@unihelp/conocimiento` y `@unihelp/tickets` que usan
   * las rutas del frontend y del ejecutor (registro del turno, restablecimiento,
   * auditoria, lecturas fuera del chat).
   */
  readonly imports: readonly (Type<unknown> | DynamicModule)[];
  /** Enlace de `PUERTO_CAPACIDADES` con la implementacion de la arquitectura. */
  readonly puertoCapacidades: Provider;
  readonly configuracion?: ConfiguracionAgente;
  readonly entorno?: Readonly<Record<string, string | undefined>>;
  /**
   * Prompt de sistema. Por defecto `PROMPT_BASE`; el orquestador de B2 y B3
   * aporta el suyo, derivado del base con un delta publicado (decision 44).
   */
  readonly prompt?: string;
  /**
   * Nombre y protocolo del agente en la traza cuando la app no es un agente
   * unico (`tool_calls[].agente`, `transporte`). Por defecto se derivan del rol
   * de la identidad de salud.
   */
  readonly agente?: { readonly nombre: string; readonly protocolo?: ProtocoloIntegracion };
}

/**
 * Nucleo del agente: bucle, cliente del modelo con casetes, presupuesto,
 * instrumentacion, extraccion del objeto final, capa de conversacion y las
 * rutas del contrato (`RUTAS_API`) y del ejecutor (`RUTAS_EXPERIMENTO`). Es el
 * MISMO codigo en B0 y B1: la unica pieza que cada arquitectura aporta es la
 * implementacion de `PuertoCapacidades` (en proceso o cliente MCP). Si el
 * nucleo se copiara por arquitectura, `B1 - B0` mediria tambien las copias y no
 * el transporte (H1, RNF-01). El orquestador de B2 y B3 tambien es este nucleo,
 * con un puerto cuyas herramientas son delegaciones a los especialistas y las
 * de tickets por MCP, y con su prompt (decision 44).
 *
 * La configuracion se lee al arrancar y un valor faltante detiene el arranque.
 * Arquitectura completa en `apps/b0-directo/docs/ARQUITECTURA.md`; lo que B1
 * cambia, en `apps/b1-mcp-agente/docs/ARQUITECTURA.md`.
 */
@Module({})
export class AgenteNucleoModule {
  static forRoot(opciones: OpcionesAgenteNucleo): DynamicModule {
    const entorno = opciones.entorno ?? process.env;
    const configuracion = opciones.configuracion ?? leerConfiguracionAgente(entorno);
    // Las rutas del ejecutor solo existen en el perfil de experimento: fuera de
    // el, restablecer borraria una base real y el controlador ni se registra
    // (decision 32). Se exigen los dos restablecimientos porque una ejecucion
    // con el conocimiento restablecido y los tickets de la anterior no sirve.
    const perfilDeExperimento =
      perfilPermiteRestablecer(entorno) && perfilPermiteVaciarTickets(entorno);
    return {
      module: AgenteNucleoModule,
      imports: [...opciones.imports],
      controllers: [
        ConversacionController,
        TicketsController,
        ConsultasController,
        ModeloIaController,
        ...(perfilDeExperimento ? [ExperimentoController] : []),
      ],
      providers: [
        { provide: CONFIGURACION_AGENTE, useValue: configuracion },
        {
          provide: IDENTIDAD_AGENTE,
          useValue: identidadAgenteDe(opciones.identidad, opciones.agente),
        },
        { provide: PROMPT_SISTEMA, useValue: opciones.prompt ?? PROMPT_BASE },
        { provide: APP_FILTER, useClass: FiltroErrores },
        opciones.puertoCapacidades,
        CaseteModelo,
        ClienteModelo,
        ConfiguracionModeloRuntime,
        CatalogoServicios,
        PresupuestoEjecucion,
        InstrumentadorTrazas,
        ExtractorObjetoFinal,
        BucleAgente,
        EnsambladorRespuesta,
        RepositorioConversaciones,
        AtenderTurnoUseCase,
      ],
      // Lo que un adaptador de otro transporte (el endpoint A2A del orquestador
      // de B3) necesita para atender la MISMA conversacion que las rutas REST.
      exports: [AtenderTurnoUseCase, InstrumentadorTrazas, RepositorioConversaciones],
    };
  }
}

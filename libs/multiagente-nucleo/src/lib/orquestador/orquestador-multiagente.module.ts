import { Module } from '@nestjs/common';
import type { DynamicModule, Provider, Type } from '@nestjs/common';
import {
  AgenteNucleoModule,
  type ConfiguracionAgente,
  leerConfiguracionAgente,
} from '@unihelp/agente-nucleo';
import { CapacidadesMcpModule, leerUrlServidorMcp } from '@unihelp/capacidades-mcp';
import { ConocimientoModule } from '@unihelp/conocimiento';
import type { IdentidadServicio } from '@unihelp/contratos';
import { PUERTO_CAPACIDADES } from '@unihelp/herramientas';
import { TicketsModule } from '@unihelp/tickets';
import { PROMPT_ORQUESTADOR } from '../prompts/prompt-orquestador';
import { A2aOrquestadorController } from './a2a-orquestador.controller';
import { CapacidadesOrquestador, PROTOCOLO_DELEGACION } from './capacidades-orquestador';

export interface OpcionesOrquestadorMultiagente {
  /** Identidad de salud de la app (B2 o el orquestador de B3); su `protocolo` firma las delegaciones. */
  readonly identidad: IdentidadServicio;
  readonly configuracion?: ConfiguracionAgente;
  readonly entorno?: Readonly<Record<string, string | undefined>>;
  /**
   * La pieza propia de la arquitectura: el modulo que provee la implementacion
   * de `PuertoEspecialistas` (en proceso en B2, cliente A2A en B3) y el enlace
   * de `PUERTO_ESPECIALISTAS` con ella.
   */
  readonly especialistas: {
    readonly imports: readonly (Type<unknown> | DynamicModule)[];
    readonly puerto: Provider;
  };
  /** B3: ademas del contrato REST, atiende `message/send` en `POST /a2a` (docs/03, 2.3). */
  readonly exponerA2a?: boolean;
}

/** Modulo interno que arma el puerto compuesto del orquestador con el puerto de especialistas de la arquitectura. */
@Module({})
class PuertoOrquestadorModule {}

/**
 * El orquestador de B2 y B3 (decision 44): el MISMO nucleo del agente que B0 y
 * B1 (`AgenteNucleoModule`), con tres diferencias declaradas aqui y en ningun
 * otro lugar: su prompt (`PROMPT_ORQUESTADOR`, un delta publicado sobre el
 * base), su puerto de capacidades (`CapacidadesOrquestador`: dos delegaciones
 * y las tres herramientas de tickets por MCP) y su identidad en la traza
 * (`agente: orquestador`). Hereda del nucleo la capa de conversacion, los
 * botones de tickets, las lecturas y las rutas del ejecutor.
 *
 * Lo unico que cada arquitectura aporta es `especialistas`: como se alcanza a
 * los especialistas. Si B2 y B3 difirieran en algo mas, `B3 - B2` mediria
 * tambien esa diferencia y no el transporte A2A (H3, RNF-01).
 */
@Module({})
export class OrquestadorMultiagenteModule {
  static forRoot(opciones: OpcionesOrquestadorMultiagente): DynamicModule {
    const entorno = opciones.entorno ?? process.env;
    const configuracion = opciones.configuracion ?? leerConfiguracionAgente(entorno);
    const puerto: DynamicModule = {
      module: PuertoOrquestadorModule,
      imports: [
        ...opciones.especialistas.imports,
        CapacidadesMcpModule.forRoot({
          urlServidorMcp: leerUrlServidorMcp(entorno),
          agente: 'orquestador',
          nombreCliente: `${opciones.identidad.servicio}/orquestador`,
        }),
      ],
      providers: [
        opciones.especialistas.puerto,
        { provide: PROTOCOLO_DELEGACION, useValue: opciones.identidad.protocolo },
        CapacidadesOrquestador,
      ],
      exports: [CapacidadesOrquestador],
    };
    return {
      module: OrquestadorMultiagenteModule,
      controllers: opciones.exponerA2a === true ? [A2aOrquestadorController] : [],
      imports: [
        AgenteNucleoModule.forRoot({
          identidad: opciones.identidad,
          configuracion,
          entorno,
          prompt: PROMPT_ORQUESTADOR,
          agente: { nombre: 'orquestador' },
          imports: [ConocimientoModule.forRoot(), TicketsModule.forRoot(), puerto],
          puertoCapacidades: { provide: PUERTO_CAPACIDADES, useExisting: CapacidadesOrquestador },
        }),
      ],
    };
  }
}

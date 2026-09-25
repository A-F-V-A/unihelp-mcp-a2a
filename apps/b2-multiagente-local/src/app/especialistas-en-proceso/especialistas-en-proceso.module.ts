import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { type ConfiguracionAgente, leerConfiguracionAgente } from '@unihelp/agente-nucleo';
import { leerUrlServidorMcp } from '@unihelp/capacidades-mcp';
import type { HabilidadA2a, IdentidadServicio } from '@unihelp/contratos';
import {
  type AgenteEspecialista,
  HABILIDAD_DE_ESPECIALISTA,
  ROLES_ESPECIALISTA,
  crearAgenteEspecialista,
} from '@unihelp/multiagente-nucleo';
import { ESPECIALISTAS_LOCALES, EspecialistasEnProceso } from './especialistas-en-proceso';

export interface OpcionesEspecialistasEnProceso {
  readonly identidad: IdentidadServicio;
  readonly configuracion?: ConfiguracionAgente;
  readonly entorno?: Readonly<Record<string, string | undefined>>;
}

/**
 * Los dos especialistas de B2, construidos con la MISMA fabrica que usa cada
 * servicio de B3 (`crearAgenteEspecialista`): cada uno con su cliente del
 * modelo y su sesion MCP con su rol, aunque compartan proceso con el orquestador.
 */
@Module({})
export class EspecialistasEnProcesoModule {
  static forRoot(opciones: OpcionesEspecialistasEnProceso): DynamicModule {
    const entorno = opciones.entorno ?? process.env;
    const configuracion = opciones.configuracion ?? leerConfiguracionAgente(entorno);
    const urlServidorMcp = leerUrlServidorMcp(entorno);
    return {
      module: EspecialistasEnProcesoModule,
      providers: [
        {
          provide: ESPECIALISTAS_LOCALES,
          useFactory: (): ReadonlyMap<HabilidadA2a, AgenteEspecialista> =>
            new Map(
              ROLES_ESPECIALISTA.map((rol) => [
                HABILIDAD_DE_ESPECIALISTA[rol],
                crearAgenteEspecialista({
                  rol,
                  identidad: opciones.identidad,
                  configuracion,
                  urlServidorMcp,
                }),
              ]),
            ),
        },
        EspecialistasEnProceso,
      ],
      exports: [EspecialistasEnProceso],
    };
  }
}

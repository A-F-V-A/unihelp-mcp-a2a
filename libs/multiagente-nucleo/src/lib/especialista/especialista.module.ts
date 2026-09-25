import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { type ConfiguracionAgente, leerConfiguracionAgente } from '@unihelp/agente-nucleo';
import { leerUrlServidorMcp } from '@unihelp/capacidades-mcp';
import type { IdentidadServicio } from '@unihelp/contratos';
import type { RolEspecialista } from '../roles';
import { A2aEspecialistaController, AGENTE_ESPECIALISTA } from './a2a-especialista.controller';
import { crearAgenteEspecialista } from './fabrica-especialista';

export interface OpcionesEspecialistaModule {
  readonly rol: RolEspecialista;
  readonly identidad: IdentidadServicio;
  readonly configuracion?: ConfiguracionAgente;
  readonly entorno?: Readonly<Record<string, string | undefined>>;
}

/**
 * Un servicio especialista de B3: el agente de su rol y el endpoint A2A que lo
 * expone. La app solo aporta su identidad de salud y la tarjeta de agente. El
 * modelo, los casetes y los limites se leen del entorno igual que en el
 * orquestador y en B0/B1 (`leerConfiguracionAgente`, RNF-01).
 */
@Module({})
export class EspecialistaModule {
  static forRoot(opciones: OpcionesEspecialistaModule): DynamicModule {
    const entorno = opciones.entorno ?? process.env;
    const configuracion = opciones.configuracion ?? leerConfiguracionAgente(entorno);
    const urlServidorMcp = leerUrlServidorMcp(entorno);
    return {
      module: EspecialistaModule,
      controllers: [A2aEspecialistaController],
      providers: [
        {
          provide: AGENTE_ESPECIALISTA,
          useFactory: () =>
            crearAgenteEspecialista({
              rol: opciones.rol,
              identidad: opciones.identidad,
              configuracion,
              urlServidorMcp,
            }),
        },
      ],
      exports: [AGENTE_ESPECIALISTA],
    };
  }
}

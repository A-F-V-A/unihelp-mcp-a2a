import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { CapacidadesMcp } from './capacidades-mcp';
import { CONFIGURACION_B1, type ConfiguracionB1 } from './configuracion-b1';

/** El cliente MCP de B1 y su configuracion, listos para enlazarse a `PUERTO_CAPACIDADES`. */
@Module({})
export class CapacidadesMcpModule {
  static forRoot(configuracion: ConfiguracionB1): DynamicModule {
    return {
      module: CapacidadesMcpModule,
      providers: [{ provide: CONFIGURACION_B1, useValue: configuracion }, CapacidadesMcp],
      exports: [CapacidadesMcp],
    };
  }
}

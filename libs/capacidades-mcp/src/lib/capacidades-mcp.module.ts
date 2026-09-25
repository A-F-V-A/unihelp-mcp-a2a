import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { CapacidadesMcp } from './capacidades-mcp';
import {
  CONFIGURACION_CLIENTE_MCP,
  type ConfiguracionClienteMcp,
} from './configuracion-cliente-mcp';

/**
 * El cliente MCP y su configuracion, listos para enlazarse a `PUERTO_CAPACIDADES`
 * (B1) o para que un agente de B2/B3 lo use con su rol. Una app que necesite
 * VARIOS clientes con roles distintos en el mismo proceso (B2) construye las
 * instancias con `new CapacidadesMcp(configuracion, null)` en una fabrica.
 */
@Module({})
export class CapacidadesMcpModule {
  static forRoot(configuracion: ConfiguracionClienteMcp): DynamicModule {
    return {
      module: CapacidadesMcpModule,
      providers: [{ provide: CONFIGURACION_CLIENTE_MCP, useValue: configuracion }, CapacidadesMcp],
      exports: [CapacidadesMcp],
    };
  }
}

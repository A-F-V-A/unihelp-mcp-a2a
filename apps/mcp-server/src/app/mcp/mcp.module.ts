import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { CapacidadesModule } from '@unihelp/capacidades';
import { type ConfiguracionMcp, leerConfiguracionMcp } from './configuracion-mcp';
import { McpController } from './mcp.controller';
import { ServidorHerramientasMcp } from './servidor-herramientas-mcp';
import { SesionesMcp } from './sesiones-mcp';

/**
 * Publica las capacidades compartidas como herramientas MCP. No contiene la
 * logica de ninguna: `@unihelp/capacidades` es el mismo codigo que ejecuta B0
 * en proceso, y aqui solo cambia el transporte (RNF-01).
 */
@Module({})
export class McpModule {
  static forRoot(configuracion: ConfiguracionMcp = leerConfiguracionMcp()): DynamicModule {
    return {
      module: McpModule,
      imports: [CapacidadesModule.forRoot({ limiteLlamadas: configuracion.limiteLlamadas })],
      controllers: [McpController],
      providers: [ServidorHerramientasMcp, SesionesMcp],
    };
  }
}

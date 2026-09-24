import { Module } from '@nestjs/common';
import { CapacidadesMcpOrquestador } from './capacidades-mcp-orquestador';
import {
  CONFIGURACION_ORQUESTADOR,
  leerConfiguracionOrquestador,
} from './configuracion-orquestador';

/**
 * Modulo que provee el cliente MCP para el orquestador B3 (HU-20, HU-25).
 */
@Module({
  providers: [
    {
      provide: CONFIGURACION_ORQUESTADOR,
      useFactory: () => leerConfiguracionOrquestador(),
    },
    CapacidadesMcpOrquestador,
  ],
  exports: [CapacidadesMcpOrquestador],
})
export class CapacidadesMcpOrquestadorModule {}

import { Module } from '@nestjs/common';
import { CapacidadesMcpConocimiento } from './capacidades-mcp-conocimiento';
import {
  CONFIGURACION_CONOCIMIENTO,
  leerConfiguracionConocimiento,
} from './configuracion-conocimiento';

/**
 * Modulo que provee el cliente MCP para el especialista de conocimiento (HU-20, HU-25).
 */
@Module({
  providers: [
    {
      provide: CONFIGURACION_CONOCIMIENTO,
      useFactory: () => leerConfiguracionConocimiento(),
    },
    CapacidadesMcpConocimiento,
  ],
  exports: [CapacidadesMcpConocimiento],
})
export class CapacidadesMcpConocimientoModule {}

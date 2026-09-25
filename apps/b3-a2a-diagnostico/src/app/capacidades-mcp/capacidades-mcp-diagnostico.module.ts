import { Module } from '@nestjs/common';
import { CapacidadesMcpDiagnostico } from './capacidades-mcp-diagnostico';
import {
  CONFIGURACION_DIAGNOSTICO,
  leerConfiguracionDiagnostico,
} from './configuracion-diagnostico';

/**
 * Modulo que provee el cliente MCP para el especialista de diagnostico (HU-20, HU-25).
 */
@Module({
  providers: [
    {
      provide: CONFIGURACION_DIAGNOSTICO,
      useFactory: () => leerConfiguracionDiagnostico(),
    },
    CapacidadesMcpDiagnostico,
  ],
  exports: [CapacidadesMcpDiagnostico],
})
export class CapacidadesMcpDiagnosticoModule {}

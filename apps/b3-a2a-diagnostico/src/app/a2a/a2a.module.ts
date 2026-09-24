import { Module } from '@nestjs/common';
import { CapacidadesMcpDiagnosticoModule } from '../capacidades-mcp/capacidades-mcp-diagnostico.module';
import { A2aController } from './a2a.controller';
import { IncidentDiagnosisService } from './incident-diagnosis.service';

/**
 * Modulo que expone la interfaz de comunicacion A2A del especialista de diagnostico (HU-29, HU-30).
 */
@Module({
  imports: [CapacidadesMcpDiagnosticoModule],
  controllers: [A2aController],
  providers: [IncidentDiagnosisService],
  exports: [IncidentDiagnosisService],
})
export class A2aModule {}

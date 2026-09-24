import { Module } from '@nestjs/common';
import { CapacidadesMcpConocimientoModule } from '../capacidades-mcp/capacidades-mcp-conocimiento.module';
import { A2aController } from './a2a.controller';
import { KnowledgeLookupService } from './knowledge-lookup.service';

/**
 * Modulo que expone la interfaz de comunicacion A2A del especialista de conocimiento (HU-29, HU-30).
 */
@Module({
  imports: [CapacidadesMcpConocimientoModule],
  controllers: [A2aController],
  providers: [KnowledgeLookupService],
  exports: [KnowledgeLookupService],
})
export class A2aModule {}

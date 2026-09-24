import { Module } from '@nestjs/common';
import { AgentCardController } from './agent-card.controller';

/**
 * Modulo que sirve la Agent Card de b3-a2a-diagnostico segun el estandar A2A v1.0 (HU-29).
 */
@Module({
  controllers: [AgentCardController],
})
export class AgentCardModule {}

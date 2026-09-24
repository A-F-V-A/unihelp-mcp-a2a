import { Module } from '@nestjs/common';
import { AgentCardModule } from './agent-card/agent-card.module';
import { SaludModule } from './salud/salud.module';

@Module({
  imports: [SaludModule, AgentCardModule],
})
export class AppModule {}

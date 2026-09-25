import { Module } from '@nestjs/common';
import { A2aModule } from './a2a/a2a.module';
import { AgentCardModule } from './agent-card/agent-card.module';
import { SaludModule } from './salud/salud.module';

@Module({
  imports: [SaludModule, AgentCardModule, A2aModule],
})
export class AppModule {}

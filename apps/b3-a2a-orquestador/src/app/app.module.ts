import { Module } from '@nestjs/common';
import { AgentCardModule } from './agent-card/agent-card.module';
import { RegistroA2aModule } from './registro-a2a/registro-a2a.module';
import { SaludModule } from './salud/salud.module';

@Module({
  imports: [SaludModule, AgentCardModule, RegistroA2aModule],
})
export class AppModule {}

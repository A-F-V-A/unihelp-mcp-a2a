import { Module } from '@nestjs/common';
import { A2aOrquestadorModule } from './a2a/a2a.module';
import { AgentCardModule } from './agent-card/agent-card.module';
import { ConversacionB3Module } from './conversacion/conversacion-b3.module';
import { RegistroA2aModule } from './registro-a2a/registro-a2a.module';
import { SaludModule } from './salud/salud.module';

@Module({
  imports: [
    SaludModule,
    AgentCardModule,
    RegistroA2aModule,
    ConversacionB3Module,
    A2aOrquestadorModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { EspecialistaModule } from '@unihelp/multiagente-nucleo';
import { AgentCardModule } from './agent-card/agent-card.module';
import { IDENTIDAD } from './salud/identidad';
import { SaludModule } from './salud/salud.module';

/**
 * B3, especialista de conocimiento: el agente de su rol del nucleo multiagente
 * compartido (`@unihelp/multiagente-nucleo`, decision 44) expuesto como servicio
 * A2A independiente. La app solo aporta su identidad de salud y su Agent Card;
 * el agente, su prompt, su cliente MCP con `X-Agent-Id: conocimiento` y el endpoint
 * `POST /a2a` vienen de la libreria, que es la MISMA que B2 invoca en proceso.
 */
@Module({
  imports: [
    SaludModule,
    AgentCardModule,
    EspecialistaModule.forRoot({ rol: 'conocimiento', identidad: IDENTIDAD }),
  ],
})
export class AppModule {}

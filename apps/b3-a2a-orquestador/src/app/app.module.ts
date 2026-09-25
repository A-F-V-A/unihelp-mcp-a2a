import { Module } from '@nestjs/common';
import { OrquestadorMultiagenteModule, PUERTO_ESPECIALISTAS } from '@unihelp/multiagente-nucleo';
import { AgentCardModule } from './agent-card/agent-card.module';
import { EspecialistasA2a } from './especialistas-a2a/especialistas-a2a';
import { EspecialistasA2aModule } from './especialistas-a2a/especialistas-a2a.module';
import { IDENTIDAD } from './salud/identidad';
import { SaludModule } from './salud/salud.module';

/**
 * B3, orquestador: el MISMO nucleo multiagente que B2 (orquestador con modelo,
 * dos delegaciones y las herramientas de tickets por MCP) con una sola
 * diferencia: `PUERTO_ESPECIALISTAS` se enlaza con `EspecialistasA2a`, un
 * cliente que descubre a los especialistas por su Agent Card y les envia
 * `message/send` por HTTP. Nada mas cambia (H3, RNF-01; decision 44).
 *
 * Ademas del contrato REST que usan el frontend y el ejecutor, publica su Agent
 * Card y atiende `message/send` en `/a2a` (docs/03, 2.3). Las rutas del ejecutor
 * (`/experimento/*`) y los botones de tickets los hereda del nucleo.
 */
@Module({
  imports: [
    SaludModule,
    AgentCardModule,
    OrquestadorMultiagenteModule.forRoot({
      identidad: IDENTIDAD,
      especialistas: {
        imports: [EspecialistasA2aModule],
        puerto: { provide: PUERTO_ESPECIALISTAS, useExisting: EspecialistasA2a },
      },
      exponerA2a: true,
    }),
  ],
})
export class AppModule {}

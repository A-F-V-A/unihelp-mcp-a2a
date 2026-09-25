import { Module } from '@nestjs/common';
import { OrquestadorMultiagenteModule, PUERTO_ESPECIALISTAS } from '@unihelp/multiagente-nucleo';
import { EspecialistasEnProceso } from './especialistas-en-proceso/especialistas-en-proceso';
import { EspecialistasEnProcesoModule } from './especialistas-en-proceso/especialistas-en-proceso.module';
import { IDENTIDAD } from './salud/identidad';
import { SaludModule } from './salud/salud.module';

/**
 * B2: el MISMO nucleo multiagente que el orquestador de B3 (orquestador con
 * modelo, dos delegaciones y las herramientas de tickets por MCP) con una sola
 * diferencia: `PUERTO_ESPECIALISTAS` se enlaza con `EspecialistasEnProceso`, que
 * invoca a los dos especialistas dentro de este mismo proceso, sin red entre
 * agentes. Los especialistas son los mismos que corren como servicios en B3
 * (`crearAgenteEspecialista`) y alcanzan sus herramientas por MCP igual que
 * alli (decisiones 44 y 45): `B3 - B2` mide solo el transporte A2A (H3).
 */
@Module({
  imports: [
    SaludModule,
    OrquestadorMultiagenteModule.forRoot({
      identidad: IDENTIDAD,
      especialistas: {
        imports: [EspecialistasEnProcesoModule.forRoot({ identidad: IDENTIDAD })],
        puerto: { provide: PUERTO_ESPECIALISTAS, useExisting: EspecialistasEnProceso },
      },
    }),
  ],
})
export class AppModule {}

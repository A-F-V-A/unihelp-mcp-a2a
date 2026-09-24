import { Module } from '@nestjs/common';
import { AgenteNucleoModule, leerConfiguracionAgente } from '@unihelp/agente-nucleo';
import { ConocimientoModule } from '@unihelp/conocimiento';
import { PUERTO_CAPACIDADES } from '@unihelp/herramientas';
import { TicketsModule } from '@unihelp/tickets';
import { CapacidadesMcp } from './capacidades-mcp/capacidades-mcp';
import { CapacidadesMcpModule } from './capacidades-mcp/capacidades-mcp.module';
import { leerConfiguracionB1 } from './capacidades-mcp/configuracion-b1';
import { IDENTIDAD } from './salud/identidad';
import { SaludModule } from './salud/salud.module';

const configuracion = leerConfiguracionAgente();

/**
 * B1: el MISMO nucleo compartido que B0 con una sola diferencia: las cinco
 * capacidades se alcanzan por MCP. `PUERTO_CAPACIDADES` se enlaza con
 * `CapacidadesMcp`, un cliente que descubre las herramientas con `tools/list` y
 * las invoca con `tools/call` contra `mcp-server`. Nada mas cambia (RNF-01, H1).
 *
 * `ConocimientoModule` y `TicketsModule` se importan por las rutas que NO son
 * capacidades del agente y que B0 tambien atiende en proceso: registro del
 * turno literal (decision 26), botones del frontend, lecturas de politica y
 * estado, y las rutas del ejecutor (restablecer, auditoria). Las capacidades del
 * agente nunca pasan por ellos: pasan por el puerto.
 * Arquitectura en `apps/b1-mcp-agente/docs/ARQUITECTURA.md`.
 */
@Module({
  imports: [
    SaludModule,
    AgenteNucleoModule.forRoot({
      identidad: IDENTIDAD,
      configuracion,
      imports: [
        ConocimientoModule.forRoot(),
        TicketsModule.forRoot(),
        CapacidadesMcpModule.forRoot(leerConfiguracionB1()),
      ],
      puertoCapacidades: { provide: PUERTO_CAPACIDADES, useExisting: CapacidadesMcp },
    }),
  ],
})
export class AppModule {}

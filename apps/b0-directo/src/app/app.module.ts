import { Module } from '@nestjs/common';
import { AgenteNucleoModule, leerConfiguracionAgente } from '@unihelp/agente-nucleo';
import { CapacidadesLocales, CapacidadesModule } from '@unihelp/capacidades';
import { PUERTO_CAPACIDADES } from '@unihelp/herramientas';
import { IDENTIDAD } from './salud/identidad';
import { SaludModule } from './salud/salud.module';

const configuracion = leerConfiguracionAgente();

/**
 * B0: el nucleo compartido del agente unico con sus cinco capacidades EN
 * PROCESO. La invocacion que el modelo pide termina en `CapacidadesLocales`,
 * sin protocolo intermedio: es la unica pieza que B1 reemplaza por un cliente
 * MCP. Arquitectura completa en `apps/b0-directo/docs/ARQUITECTURA.md`.
 */
@Module({
  imports: [
    SaludModule,
    AgenteNucleoModule.forRoot({
      identidad: IDENTIDAD,
      configuracion,
      imports: [
        CapacidadesModule.forRoot({ limiteLlamadas: configuracion.limites.llamadasHerramienta }),
      ],
      puertoCapacidades: { provide: PUERTO_CAPACIDADES, useExisting: CapacidadesLocales },
    }),
  ],
})
export class AppModule {}

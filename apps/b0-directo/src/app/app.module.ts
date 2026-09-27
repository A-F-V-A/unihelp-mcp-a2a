import { Module } from '@nestjs/common';
import { AgenteNucleoModule, leerConfiguracionAgente } from '@unihelp/agente-nucleo';
import {
  CapacidadesLocales,
  CapacidadesModule,
  ConsultarDisponibilidadSoporteCapacidad,
  RegistroCapacidades,
} from '@unihelp/capacidades';
import {
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  PUERTO_CAPACIDADES,
  promptConDisponibilidadSoporte,
} from '@unihelp/herramientas';
import { IDENTIDAD } from './salud/identidad';
import { SaludModule } from './salud/salud.module';

const configuracion = leerConfiguracionAgente();

/**
 * B0: el nucleo compartido del agente unico con sus capacidades EN PROCESO. La
 * invocacion que el modelo pide termina en `CapacidadesLocales`, sin protocolo
 * intermedio: es la unica pieza que B1 reemplaza por un cliente MCP.
 * Arquitectura completa en `apps/b0-directo/docs/ARQUITECTURA.md`.
 *
 * Ademas de las cinco del contrato, B0 ofrece la sexta herramienta,
 * `consultar_disponibilidad_soporte` (HU-43): la lista de B0 es compilada, asi
 * que agregarla exige tocar este cableado y redesplegar (M6.1 a M6.5). Se
 * registra de forma aditiva en `RegistroCapacidades` al construir el puerto,
 * antes de que el nucleo pida la lista, y el prompt suma la seccion que la
 * saca de la regla de "fuera de alcance".
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
      prompt: promptConDisponibilidadSoporte(),
      puertoCapacidades: {
        provide: PUERTO_CAPACIDADES,
        useFactory: (registro: RegistroCapacidades, locales: CapacidadesLocales) => {
          registro.agregar(
            DEFINICION_DISPONIBILIDAD_SOPORTE,
            new ConsultarDisponibilidadSoporteCapacidad(),
          );
          return locales;
        },
        inject: [RegistroCapacidades, CapacidadesLocales],
      },
    }),
  ],
})
export class AppModule {}

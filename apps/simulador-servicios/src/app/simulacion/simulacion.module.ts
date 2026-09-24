import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConocimientoModule, perfilPermiteRestablecer } from '@unihelp/conocimiento';
import { FiltroErrores } from '../http/filtro-errores';
import { AulaVirtualController } from './controladores/aula-virtual.controller';
import { AutenticacionController } from './controladores/autenticacion.controller';
import { CorreoInstitucionalController } from './controladores/correo-institucional.controller';
import {
  ConmutarEstadoInicialController,
  EstadoInicialController,
} from './controladores/estado-inicial.controller';
import { MatriculaController } from './controladores/matricula.controller';
import { PanelController } from './controladores/panel.controller';
import { SaludDeSistemas } from './salud-de-sistemas';
import { CatalogoSistemas } from './sistemas-emulados';

/**
 * Los cuatro sistemas universitarios emulados, mas el panel y el conmutador de
 * estado inicial (decision 33).
 *
 * Este modulo NO tiene datos propios: todo sale de `ConocimientoModule`, la
 * misma libreria y la misma base que leen los agentes. Si el simulador tuviera
 * su propia copia del estado de servicios, la huella de HU-36 dejaria de cubrir
 * lo que el agente consulta y dos fuentes podrian divergir sin que nadie lo
 * note.
 */
@Module({})
export class SimulacionModule {
  static forRoot(
    entorno: Readonly<Record<string, string | undefined>> = process.env,
  ): DynamicModule {
    // Conmutar borra la base: fuera del perfil de experimento el controlador ni
    // se registra y la ruta devuelve 404, igual que `/experimento/*` en B0
    // (decision 32). Los `GET` siguen disponibles en cualquier perfil.
    const puedeConmutar = perfilPermiteRestablecer(entorno);
    return {
      module: SimulacionModule,
      imports: [ConocimientoModule.forRoot()],
      controllers: [
        PanelController,
        EstadoInicialController,
        ...(puedeConmutar ? [ConmutarEstadoInicialController] : []),
        AulaVirtualController,
        AutenticacionController,
        CorreoInstitucionalController,
        MatriculaController,
      ],
      providers: [
        { provide: APP_FILTER, useClass: FiltroErrores },
        CatalogoSistemas,
        SaludDeSistemas,
      ],
    };
  }
}

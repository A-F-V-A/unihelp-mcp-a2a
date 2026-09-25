import { Module } from '@nestjs/common';
import { RepositorioTareasService } from './repositorio-tareas.service';

/**
 * Modulo del repositorio de tareas A2A para el orquestador B3 (HU-31).
 */
@Module({
  providers: [RepositorioTareasService],
  exports: [RepositorioTareasService],
})
export class RepositorioTareasModule {}

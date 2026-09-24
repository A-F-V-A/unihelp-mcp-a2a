import { Module } from '@nestjs/common';
import { ClienteA2aModule } from '../a2a-cliente/cliente-a2a.module';
import { CapacidadesMcpOrquestadorModule } from '../capacidades-mcp/capacidades-mcp-orquestador.module';
import { ClasificadorModule } from '../clasificador/clasificador.module';
import { RegistroA2aModule } from '../registro-a2a/registro-a2a.module';
import { RepositorioTareasModule } from '../tareas/repositorio-tareas.module';
import { TriajeService } from './triaje.service';

/**
 * Modulo principal de triaje para la orquestacion B3 (HU-01 a HU-17, HU-29 a HU-34).
 */
@Module({
  imports: [
    ClasificadorModule,
    RegistroA2aModule,
    ClienteA2aModule,
    CapacidadesMcpOrquestadorModule,
    RepositorioTareasModule,
  ],
  providers: [TriajeService],
  exports: [TriajeService],
})
export class TriajeModule {}

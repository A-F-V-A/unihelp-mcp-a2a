import { Module } from '@nestjs/common';
import { ClasificadorService } from './clasificador.service';

/**
 * Modulo de clasificacion de solicitudes para el orquestador B3 (HU-02).
 */
@Module({
  providers: [ClasificadorService],
  exports: [ClasificadorService],
})
export class ClasificadorModule {}

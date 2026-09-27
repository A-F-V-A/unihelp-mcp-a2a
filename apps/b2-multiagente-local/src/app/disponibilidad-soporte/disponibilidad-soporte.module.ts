import { Module } from '@nestjs/common';
import { CapacidadesSoporteEnProceso } from './capacidades-soporte-en-proceso';

/** Provee `CapacidadesSoporteEnProceso` para el orquestador de B2 (decision 60). */
@Module({
  providers: [CapacidadesSoporteEnProceso],
  exports: [CapacidadesSoporteEnProceso],
})
export class DisponibilidadSoporteModule {}

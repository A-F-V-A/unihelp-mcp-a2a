import { Module } from '@nestjs/common';
import { RegistroA2aService } from './registro-a2a.service';

/**
 * Modulo de registro y descubrimiento dinamico de agentes especialistas A2A (HU-29).
 */
@Module({
  providers: [RegistroA2aService],
  exports: [RegistroA2aService],
})
export class RegistroA2aModule {}

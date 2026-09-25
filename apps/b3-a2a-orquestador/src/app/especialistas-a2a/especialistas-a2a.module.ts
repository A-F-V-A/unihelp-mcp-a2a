import { Module } from '@nestjs/common';
import { RegistroA2aModule } from '../registro-a2a/registro-a2a.module';
import { EspecialistasA2a } from './especialistas-a2a';

/** El puerto de especialistas de B3 (cliente A2A) con el registro de descubrimiento del que depende. */
@Module({
  imports: [RegistroA2aModule],
  providers: [EspecialistasA2a],
  exports: [EspecialistasA2a],
})
export class EspecialistasA2aModule {}

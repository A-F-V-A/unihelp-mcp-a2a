import { Module } from '@nestjs/common';
import { TriajeModule } from '../triaje/triaje.module';
import { A2aOrquestadorController } from './a2a.controller';

/**
 * Modulo que expone la interfaz A2A v1.0 JSON-RPC 2.0 del orquestador (HU-29, HU-30).
 */
@Module({
  imports: [TriajeModule],
  controllers: [A2aOrquestadorController],
})
export class A2aOrquestadorModule {}

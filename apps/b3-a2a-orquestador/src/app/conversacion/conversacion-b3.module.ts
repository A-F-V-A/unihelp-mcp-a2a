import { Module } from '@nestjs/common';
import { TriajeModule } from '../triaje/triaje.module';
import { ConversacionB3Controller } from './conversacion-b3.controller';

/**
 * Modulo que expone la API REST de conversaciones para el frontend (HU-01, HU-04).
 */
@Module({
  imports: [TriajeModule],
  controllers: [ConversacionB3Controller],
})
export class ConversacionB3Module {}

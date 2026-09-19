import { Module } from '@nestjs/common';
import { AgenteModule } from './agente.module';
import { SaludModule } from './salud/salud.module';

@Module({
  imports: [SaludModule, AgenteModule.forRoot()],
})
export class AppModule {}

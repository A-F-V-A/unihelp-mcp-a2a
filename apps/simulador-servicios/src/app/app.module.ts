import { Module } from '@nestjs/common';
import { SaludModule } from './salud/salud.module';
import { SimulacionModule } from './simulacion/simulacion.module';

@Module({
  imports: [SaludModule, SimulacionModule.forRoot()],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConsolaModule } from './consola/consola.module';
import { FiltroErrores } from './http/filtro-errores';
import { SaludModule } from './salud/salud.module';

@Module({
  imports: [SaludModule, ConsolaModule],
  providers: [{ provide: APP_FILTER, useClass: FiltroErrores }],
})
export class AppModule {}

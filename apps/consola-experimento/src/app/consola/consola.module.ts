import { Module } from '@nestjs/common';
import { ConsolaController } from './consola.controller';
import { TrabajosService } from './trabajos.service';

@Module({
  controllers: [ConsolaController],
  providers: [TrabajosService],
})
export class ConsolaModule {}

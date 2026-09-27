import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { RevisionController } from './revision.controller';
import { DIRECTORIO_REVISION, RevisionService } from './revision.service';

/**
 * Revision humana del juez (M7.4, M7.5). Usa el mismo directorio del experimento
 * que `TrabajosService` (`UNIHELP_DIRECTORIO_EXPERIMENTO`, `experiment` por defecto).
 */
@Module({
  controllers: [RevisionController],
  providers: [
    {
      provide: DIRECTORIO_REVISION,
      useFactory: (): string =>
        resolve(
          process.cwd(),
          process.env.UNIHELP_DIRECTORIO_EXPERIMENTO ?? 'experiment',
          'juez',
          'revision-humana',
        ),
    },
    RevisionService,
  ],
})
export class RevisionModule {}

import { Module } from '@nestjs/common';
import { ClienteA2aService } from './cliente-a2a.service';

/**
 * Modulo del cliente A2A para llamar a especialistas remotos (HU-29).
 */
@Module({
  providers: [ClienteA2aService],
  exports: [ClienteA2aService],
})
export class ClienteA2aModule {}

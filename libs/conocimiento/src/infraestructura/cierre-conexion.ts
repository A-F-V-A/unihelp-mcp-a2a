import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE_CONOCIMIENTO } from './data-source';

/** Cierra la conexion propia de la libreria cuando la app se detiene. */
@Injectable()
export class CierreConexionConocimiento implements OnModuleDestroy {
  constructor(@Inject(DATA_SOURCE_CONOCIMIENTO) private readonly dataSource: DataSource) {}

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}

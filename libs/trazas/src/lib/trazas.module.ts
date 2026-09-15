import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { PersistidorTrazas } from './persistidor-trazas';
import type { OpcionesPersistidorTrazas } from './persistidor-trazas';
import { ValidadorTrazas } from './validador-trazas';

/**
 * Modulo NestJS que expone `ValidadorTrazas` y `PersistidorTrazas` para una corrida.
 * El mismo modulo sirve a las cuatro arquitecturas: validar trazas no es la variable
 * que mide el experimento.
 */
@Module({})
export class TrazasModule {
  static registrar(opciones: OpcionesPersistidorTrazas): DynamicModule {
    return {
      module: TrazasModule,
      providers: [
        { provide: ValidadorTrazas, useFactory: () => new ValidadorTrazas() },
        {
          provide: PersistidorTrazas,
          useFactory: (validador: ValidadorTrazas) => new PersistidorTrazas(opciones, validador),
          inject: [ValidadorTrazas],
        },
      ],
      exports: [ValidadorTrazas, PersistidorTrazas],
    };
  }
}

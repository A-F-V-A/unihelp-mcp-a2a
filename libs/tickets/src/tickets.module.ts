import { Inject, Injectable, Module } from '@nestjs/common';
import type { DynamicModule, OnModuleDestroy, Provider } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { resolverUrlTickets } from './aplicacion/configuracion';
import type { OpcionesTickets } from './aplicacion/configuracion';
import { ConfirmarPropuestaUseCase } from './aplicacion/confirmar-propuesta.use-case';
import { ConsultarPropuestasUseCase } from './aplicacion/consultar-propuestas.use-case';
import { CrearTicketUseCase } from './aplicacion/crear-ticket.use-case';
import { ProponerTicketUseCase } from './aplicacion/proponer-ticket.use-case';
import { RegistrarTurnoUseCase } from './aplicacion/registrar-turno.use-case';
import { RegistroAuditoria } from './aplicacion/registro-auditoria';
import { RELOJ_TICKETS, TICKETS_REPOSITORY } from './aplicacion/tokens';
import { abrirDataSourceTickets, DATA_SOURCE_TICKETS } from './infraestructura/data-source';
import { TypeOrmTicketsRepository } from './infraestructura/typeorm-tickets.repository';

/** Cierra la conexion propia cuando la app se detiene. */
@Injectable()
class CierreConexionTickets implements OnModuleDestroy {
  constructor(@Inject(DATA_SOURCE_TICKETS) private readonly dataSource: DataSource) {}

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}

const CASOS_DE_USO = [
  RegistroAuditoria,
  RegistrarTurnoUseCase,
  ProponerTicketUseCase,
  ConfirmarPropuestaUseCase,
  CrearTicketUseCase,
  ConsultarPropuestasUseCase,
];

/**
 * Modulo NestJS del registro controlado de tickets y de la auditoria. Lo usan
 * B0 y lo usara `mcp-server`, para que la garantia de HU-16 sea el MISMO codigo
 * en todas las arquitecturas (RNF-01).
 */
@Module({})
export class TicketsModule {
  static forRoot(
    opciones: OpcionesTickets = {},
    entorno: Readonly<Record<string, string | undefined>> = process.env,
  ): DynamicModule {
    const url = resolverUrlTickets(opciones, entorno);
    const providers: Provider[] = [
      { provide: DATA_SOURCE_TICKETS, useFactory: () => abrirDataSourceTickets(url) },
      {
        provide: TICKETS_REPOSITORY,
        useFactory: (dataSource: DataSource) => new TypeOrmTicketsRepository(dataSource),
        inject: [DATA_SOURCE_TICKETS],
      },
      { provide: RELOJ_TICKETS, useValue: { ahora: () => new Date() } },
      CierreConexionTickets,
      ...CASOS_DE_USO,
    ];
    return { module: TicketsModule, providers, exports: CASOS_DE_USO };
  }
}

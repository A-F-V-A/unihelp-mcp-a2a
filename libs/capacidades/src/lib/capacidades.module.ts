import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConocimientoModule } from '@unihelp/conocimiento';
import {
  EjecutorCapacidad,
  LIMITE_LLAMADAS_POR_DEFECTO,
  ValidadorArgumentos,
} from '@unihelp/herramientas';
import { RegistroAuditoria, TicketsModule } from '@unihelp/tickets';
import { CapacidadesLocales } from './capacidades-locales';
import { BuscarPoliticaCapacidad } from './capacidades/buscar-politica.capacidad';
import { ConfirmarPropuestaCapacidad } from './capacidades/confirmar-propuesta.capacidad';
import { ConsultarEstadoServicioCapacidad } from './capacidades/consultar-estado-servicio.capacidad';
import { CrearTicketSimuladoCapacidad } from './capacidades/crear-ticket-simulado.capacidad';
import { ProponerTicketCapacidad } from './capacidades/proponer-ticket.capacidad';
import { InvocadorCapacidades } from './invocador-capacidades';
import { RegistroCapacidades } from './registro-capacidades';
import { traducirFalloCapacidad } from './traducir-fallo';

export interface OpcionesCapacidades {
  /** Llamadas a herramientas por ejecucion antes de `LIMITE_EXCEDIDO` (RNF-04; docs/02, 5). */
  readonly limiteLlamadas?: number;
}

const CAPACIDADES = [
  BuscarPoliticaCapacidad,
  ConsultarEstadoServicioCapacidad,
  ProponerTicketCapacidad,
  ConfirmarPropuestaCapacidad,
  CrearTicketSimuladoCapacidad,
];

/**
 * Las cinco capacidades del dominio con su registro, su invocador (validacion,
 * limite, duracion y auditoria) y el puerto en proceso. Lo importan B0, que
 * invoca en proceso, y `mcp-server`, que publica el registro como herramientas:
 * la logica de cada capacidad es el mismo codigo en ambos (RNF-01).
 *
 * Reexporta `ConocimientoModule` y `TicketsModule` para que quien lo importe
 * comparta la MISMA conexion a PostgreSQL: Nest no deduplica dos `forRoot()`.
 */
@Module({})
export class CapacidadesModule {
  static forRoot(opciones: OpcionesCapacidades = {}): DynamicModule {
    return {
      module: CapacidadesModule,
      imports: [ConocimientoModule.forRoot(), TicketsModule.forRoot()],
      providers: [
        ValidadorArgumentos,
        {
          provide: EjecutorCapacidad,
          useFactory: (validador: ValidadorArgumentos, auditoria: RegistroAuditoria) =>
            new EjecutorCapacidad(
              validador,
              auditoria,
              opciones.limiteLlamadas ?? LIMITE_LLAMADAS_POR_DEFECTO,
              traducirFalloCapacidad,
            ),
          inject: [ValidadorArgumentos, RegistroAuditoria],
        },
        ...CAPACIDADES,
        RegistroCapacidades,
        InvocadorCapacidades,
        CapacidadesLocales,
      ],
      exports: [
        ConocimientoModule,
        TicketsModule,
        ValidadorArgumentos,
        EjecutorCapacidad,
        RegistroCapacidades,
        InvocadorCapacidades,
        CapacidadesLocales,
      ],
    };
  }
}

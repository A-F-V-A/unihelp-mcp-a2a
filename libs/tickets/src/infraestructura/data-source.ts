import { DataSource } from 'typeorm';
import { CrearTicketsYAuditoria1789430400000 } from './migraciones/1789430400000-crear-tickets-y-auditoria';

/** Token del `DataSource` propio de la libreria. */
export const DATA_SOURCE_TICKETS = Symbol('DATA_SOURCE_TICKETS');

/** Tabla de control de migraciones de esta libreria, separada de la de conocimiento. */
export const TABLA_MIGRACIONES_TICKETS = 'tickets_migraciones';

/**
 * Conexion propia de tickets y auditoria. Sin entidades: todas las consultas se
 * escriben en SQL explicito, como en `libs/conocimiento` (decision 16).
 */
export function crearDataSourceTickets(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    applicationName: 'unihelp-tickets',
    entities: [],
    migrations: [CrearTicketsYAuditoria1789430400000],
    migrationsTableName: TABLA_MIGRACIONES_TICKETS,
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });
}

export async function abrirDataSourceTickets(url: string): Promise<DataSource> {
  return crearDataSourceTickets(url).initialize();
}

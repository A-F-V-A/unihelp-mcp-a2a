import { DataSource } from 'typeorm';
import {
  PoliticaCategoriaEntity,
  PoliticaServicioEntity,
  ServicioComponenteEntity,
} from './entidades/aristas.entity';
import {
  CategoriaEntity,
  ComponenteEntity,
  EntornoEntity,
  EstadoServicioEntity,
  ExtractoEntity,
  PoliticaEntity,
  ServicioEntity,
  VersionPoliticaEntity,
} from './entidades/nodos.entity';
import { TABLA_MIGRACIONES } from './esquema';
import { CrearGrafoConocimiento1789344000000 } from './migraciones/1789344000000-crear-grafo-conocimiento';

/** Token del `DataSource` propio de la libreria, independiente de cualquier conexion de la app. */
export const DATA_SOURCE_CONOCIMIENTO = Symbol('DATA_SOURCE_CONOCIMIENTO');

/**
 * Conexion propia de la base de conocimiento. `synchronize` queda desactivado:
 * el esquema solo cambia por migraciones versionadas.
 */
export function crearDataSourceConocimiento(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    applicationName: 'unihelp-conocimiento',
    entities: [
      ServicioEntity,
      EstadoServicioEntity,
      ComponenteEntity,
      CategoriaEntity,
      PoliticaEntity,
      VersionPoliticaEntity,
      ExtractoEntity,
      ServicioComponenteEntity,
      PoliticaCategoriaEntity,
      PoliticaServicioEntity,
      EntornoEntity,
    ],
    migrations: [CrearGrafoConocimiento1789344000000],
    migrationsTableName: TABLA_MIGRACIONES,
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });
}

export async function abrirDataSourceConocimiento(url: string): Promise<DataSource> {
  return crearDataSourceConocimiento(url).initialize();
}

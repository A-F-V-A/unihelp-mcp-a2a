import { Module } from '@nestjs/common';
import type { DynamicModule, Provider, Type } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { BuscarPoliticaUseCase } from './aplicacion/buscar-politica.use-case';
import { resolverConfiguracionConocimiento } from './aplicacion/configuracion';
import type { OpcionesConocimiento, VariablesEntorno } from './aplicacion/configuracion';
import { ConsultarComponentesDeServicioUseCase } from './aplicacion/consultar-componentes-de-servicio.use-case';
import { ConsultarEntornoUseCase } from './aplicacion/consultar-entorno.use-case';
import { ConsultarPoliticasDeCategoriaUseCase } from './aplicacion/consultar-politicas-de-categoria.use-case';
import { ListarEstadosInicialesUseCase } from './aplicacion/listar-estados-iniciales.use-case';
import { ListarServiciosUseCase } from './aplicacion/listar-servicios.use-case';
import { ObtenerPoliticaUseCase } from './aplicacion/obtener-politica.use-case';
import { RestablecerConocimientoUseCase } from './aplicacion/restablecer-conocimiento.use-case';
import { SembrarConocimientoUseCase } from './aplicacion/sembrar-conocimiento.use-case';
import {
  CONFIGURACION_CONOCIMIENTO,
  CONOCIMIENTO_REPOSITORY,
  SEMILLA_CONOCIMIENTO,
} from './aplicacion/tokens';
import { cargarSemillaConocimiento } from './infraestructura/cargar-semilla';
import { CierreConexionConocimiento } from './infraestructura/cierre-conexion';
import {
  abrirDataSourceConocimiento,
  DATA_SOURCE_CONOCIMIENTO,
} from './infraestructura/data-source';
import { TypeOrmConocimientoRepository } from './infraestructura/typeorm-conocimiento.repository';

/**
 * Modulo NestJS de la base de conocimiento. Cada app lo importa con
 * `ConocimientoModule.forRoot()` y recibe los casos de uso ya enlazados a
 * PostgreSQL, con una conexion propia que no interfiere con la de la app.
 *
 * El perfil se evalua al llamar a `forRoot`: fuera de `UNIHELP_PERFIL=experimento`
 * o `NODE_ENV=test`, `RestablecerConocimientoUseCase` no se registra y pedirlo
 * por inyeccion hace fallar el arranque (HU-36).
 */
@Module({})
export class ConocimientoModule {
  static forRoot(
    opciones: OpcionesConocimiento = {},
    entorno: VariablesEntorno = process.env,
  ): DynamicModule {
    const configuracion = resolverConfiguracionConocimiento(opciones, entorno);
    const casosDeUso: Type<unknown>[] = [
      BuscarPoliticaUseCase,
      ConsultarComponentesDeServicioUseCase,
      ConsultarEntornoUseCase,
      ConsultarPoliticasDeCategoriaUseCase,
      ObtenerPoliticaUseCase,
      ListarEstadosInicialesUseCase,
      ListarServiciosUseCase,
      SembrarConocimientoUseCase,
      ...(configuracion.restablecimientoPermitido ? [RestablecerConocimientoUseCase] : []),
    ];
    const providers: Provider[] = [
      { provide: CONFIGURACION_CONOCIMIENTO, useValue: configuracion },
      { provide: SEMILLA_CONOCIMIENTO, useFactory: cargarSemillaConocimiento },
      {
        provide: DATA_SOURCE_CONOCIMIENTO,
        useFactory: () => abrirDataSourceConocimiento(configuracion.urlBaseDatos),
      },
      {
        provide: CONOCIMIENTO_REPOSITORY,
        useFactory: (dataSource: DataSource) => new TypeOrmConocimientoRepository(dataSource),
        inject: [DATA_SOURCE_CONOCIMIENTO],
      },
      CierreConexionConocimiento,
      ...casosDeUso,
    ];
    return { module: ConocimientoModule, providers, exports: casosDeUso };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import {
  ConsultarComponentesDeServicioUseCase,
  ConsultarEntornoUseCase,
} from '@unihelp/conocimiento';
import type {
  EstadoSistemaEmuladoDto,
  SaludSistemaDto,
  SaludSistemasDto,
} from '@unihelp/contratos';
import { aComponenteDto, aEstadoSistemaDto } from './mapeo-salud';
import { CatalogoSistemas } from './sistemas-emulados';

/**
 * Lo que responden todos los endpoints de salud del simulador. Es una sola
 * pieza porque los cuatro controladores por sistema hacen exactamente lo mismo
 * con un codigo distinto: si cada uno trajera su propia consulta, dos sistemas
 * podrian terminar publicando el mismo estado de forma diferente.
 *
 * No calcula nada: no deduce prioridad, no estima una ventana que el sistema no
 * publico (HU-10) y no interpreta el comunicado. Solo lee y traduce.
 */
@Injectable()
export class SaludDeSistemas {
  constructor(
    @Inject(CatalogoSistemas) private readonly catalogo: CatalogoSistemas,
    @Inject(ConsultarComponentesDeServicioUseCase)
    private readonly consultar: ConsultarComponentesDeServicioUseCase,
    @Inject(ConsultarEntornoUseCase) private readonly entorno: ConsultarEntornoUseCase,
  ) {}

  /** @throws ErrorApi 404 si `codigo` no es un sistema emulado. */
  async deUno(codigo: string): Promise<SaludSistemaDto> {
    const sistema = await this.catalogo.buscar(codigo);
    const resultado = await this.consultar.ejecutar(sistema.codigo);
    return {
      sistema,
      estado: aEstadoSistemaDto(resultado),
      componentes: resultado.componentes.map(aComponenteDto),
      consultadoEn: new Date().toISOString(),
    };
  }

  /**
   * Los cuatro sistemas con la misma forma del bloque `estado_inicial.servicios`
   * de una tarea. Las consultas van EN SERIE y no con `Promise.all`: el
   * simulador comparte la base con la arquitectura en ejecucion y RM-04 prohibe
   * introducir paralelismo dentro de una ejecucion.
   */
  async deTodos(): Promise<SaludSistemasDto> {
    const entorno = await this.entorno.ejecutar();
    const servicios: Record<string, EstadoSistemaEmuladoDto> = {};
    for (const sistema of await this.catalogo.todos()) {
      servicios[sistema.codigo] = aEstadoSistemaDto(await this.consultar.ejecutar(sistema.codigo));
    }
    return {
      estadoInicial: entorno.estadoInicial,
      corpus: entorno.corpus,
      versionSemilla: entorno.versionSemilla,
      servicios,
      consultadoEn: new Date().toISOString(),
    };
  }
}

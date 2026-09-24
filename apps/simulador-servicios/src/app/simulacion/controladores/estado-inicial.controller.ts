import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import {
  ConsultarEntornoUseCase,
  ListarEstadosInicialesUseCase,
  RestablecerConocimientoUseCase,
} from '@unihelp/conocimiento';
import type {
  ConmutarEstadoInicialDto,
  EstadoInicialDisponibleDto,
  EstadoInicialVigenteDto,
} from '@unihelp/contratos';
import { CORPUS_CONOCIMIENTO } from '@unihelp/contratos';
import { ErrorApi } from '../../http/error-api';

/**
 * Conmuta el entorno entre los estados iniciales de `docs/10` (seccion 4): es
 * lo que convierte al simulador en un simulador y no en un mirador.
 *
 * Conmutar BORRA y repuebla la base de conocimiento, asi que `POST` solo se
 * registra con `UNIHELP_PERFIL=experimento` (HU-36, decision 33). Sin ese
 * perfil el simulador queda de solo lectura y la ruta devuelve 404: los `GET`
 * siguen respondiendo.
 */
@Controller('simulacion')
export class EstadoInicialController {
  constructor(
    @Inject(ConsultarEntornoUseCase) private readonly entorno: ConsultarEntornoUseCase,
    @Inject(ListarEstadosInicialesUseCase)
    private readonly listar: ListarEstadosInicialesUseCase,
  ) {}

  /** `GET /simulacion/estados-iniciales`: las variantes que define la semilla. */
  @Get('estados-iniciales')
  disponibles(): readonly EstadoInicialDisponibleDto[] {
    return this.listar.ejecutar();
  }

  /**
   * `GET /simulacion/estado-inicial`: que variante esta cargada. La huella y los
   * conteos van en `null` porque solo se calculan al escribir, dentro de la
   * transaccion que restablece (HU-36): publicarlos aqui daria una huella
   * calculada fuera de esa transaccion, que es justamente la que no sirve.
   */
  @Get('estado-inicial')
  async vigente(): Promise<EstadoInicialVigenteDto> {
    const entorno = await this.entorno.ejecutar();
    return {
      estadoInicial: entorno.estadoInicial,
      corpus: entorno.corpus,
      versionSemilla: entorno.versionSemilla,
      huella: null,
      conteos: null,
    };
  }
}

/**
 * La escritura vive en su propio controlador para que `SimulacionModule` pueda
 * registrarla solo en el perfil de experimento sin arrastrar tambien los `GET`.
 */
@Controller('simulacion')
export class ConmutarEstadoInicialController {
  constructor(
    @Inject(RestablecerConocimientoUseCase)
    private readonly restablecer: RestablecerConocimientoUseCase,
  ) {}

  /**
   * `POST /simulacion/estado-inicial`: deja los cuatro sistemas como los declara
   * `estado_inicial` de una tarea y devuelve la huella del resultado (HU-36).
   *
   * NO borra el estado en proceso de la arquitectura que este corriendo
   * (conversaciones, instrumentacion, tickets): eso lo hace cada backend en
   * `POST /experimento/restablecer`, que sigue siendo la ruta del ejecutor.
   */
  @Post('estado-inicial')
  @HttpCode(200)
  async conmutar(@Body() cuerpo: unknown): Promise<EstadoInicialVigenteDto> {
    const datos = (cuerpo ?? {}) as Partial<ConmutarEstadoInicialDto>;
    const estadoInicial = typeof datos.estadoInicial === 'string' ? datos.estadoInicial.trim() : '';
    if (estadoInicial === '') {
      throw new ErrorApi('validacion', 'Falta el campo estadoInicial.', { campo: 'estadoInicial' });
    }
    // El corpus por defecto es `estandar`: las tres politicas envenenadas solo
    // entran cuando la tarea adversarial las pide explicitamente.
    const pedido: unknown = datos.corpus ?? 'estandar';
    const corpus = CORPUS_CONOCIMIENTO.find((valor) => valor === pedido);
    if (corpus === undefined) {
      throw new ErrorApi(
        'validacion',
        `El campo corpus debe ser ${CORPUS_CONOCIMIENTO.join(' o ')}.`,
        { campo: 'corpus' },
      );
    }

    const resultado = await this.restablecer.ejecutar({ estadoInicial, corpus });
    return {
      estadoInicial: resultado.estadoInicial,
      corpus: resultado.corpus,
      versionSemilla: resultado.versionSemilla,
      huella: resultado.huella,
      conteos: resultado.conteos,
    };
  }
}

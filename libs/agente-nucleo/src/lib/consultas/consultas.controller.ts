import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import type { EstadoServicioDto, PoliticaDto } from '@unihelp/contratos';
import {
  type ComponentesDeServicio,
  ConsultarComponentesDeServicioUseCase,
  ObtenerPoliticaUseCase,
} from '@unihelp/conocimiento';
import { AREAS_SERVICIO, type AreaServicio, type NivelEstadoServicio } from '@unihelp/dominio';
import { aEstadoServicioDto, aPoliticaDto } from '../conversacion/mapeo-dto';
import { CatalogoServicios } from '../catalogo/catalogo-servicios';
import { ErrorApi } from '../http/error-api';

/** De peor a mejor: el area muestra el servicio mas afectado. */
const GRAVEDAD: Readonly<Record<NivelEstadoServicio, number>> = {
  interrumpido: 0,
  degradado: 1,
  mantenimiento: 2,
  operativo: 3,
};

/**
 * Lecturas que el frontend hace fuera del chat: ver una politica completa y
 * refrescar el estado de un servicio (HU-05, HU-10). No pasan por el modelo.
 */
@Controller()
export class ConsultasController {
  constructor(
    @Inject(ObtenerPoliticaUseCase) private readonly obtenerPolitica: ObtenerPoliticaUseCase,
    @Inject(ConsultarComponentesDeServicioUseCase)
    private readonly consultarServicio: ConsultarComponentesDeServicioUseCase,
    @Inject(CatalogoServicios) private readonly catalogo: CatalogoServicios,
  ) {}

  /** `GET /api/politicas/:codigo?version=`. */
  @Get('politicas/:codigo')
  async politica(
    @Param('codigo') codigo: string,
    @Query('version') version: string | undefined,
  ): Promise<PoliticaDto> {
    const completa = await this.obtenerPolitica.ejecutar(codigo, version?.trim() || null);
    const servicio = await this.catalogo.servicio(completa.servicios[0] ?? '');
    if (servicio === undefined) {
      throw new ErrorApi('interno', 'La política no está asociada a ningún servicio del catálogo.');
    }
    return aPoliticaDto(completa, servicio.area);
  }

  /**
   * `GET /api/servicios/:servicio/estado`. El contrato identifica el servicio por
   * AREA; si un area tiene varios servicios (soporte tecnico: autenticacion y
   * correo), se muestra el mas afectado y, a igual estado, el de codigo menor.
   */
  @Get('servicios/:servicio/estado')
  async estado(@Param('servicio') area: string): Promise<EstadoServicioDto> {
    if (!(AREAS_SERVICIO as readonly string[]).includes(area)) {
      throw new ErrorApi('no-encontrado', `No existe el área de servicio «${area}».`);
    }
    const servicios = await this.catalogo.deArea(area as AreaServicio);
    if (servicios.length === 0) {
      throw new ErrorApi('no-encontrado', `UniHelp no atiende servicios del área «${area}».`);
    }
    const estados: ComponentesDeServicio[] = [];
    for (const servicio of servicios) {
      estados.push(await this.consultarServicio.ejecutar(servicio.codigo));
    }
    const [peor] = estados.sort(
      (a, b) =>
        GRAVEDAD[a.estado.estado] - GRAVEDAD[b.estado.estado] ||
        (a.servicio.codigo < b.servicio.codigo ? -1 : 1),
    );
    return aEstadoServicioDto(peor as ComponentesDeServicio);
  }
}

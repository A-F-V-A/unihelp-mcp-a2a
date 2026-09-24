import { Inject, Injectable } from '@nestjs/common';
import { ListarServiciosUseCase, type Servicio } from '@unihelp/conocimiento';
import { rutaPropiaDeSistema, type SistemaEmuladoDto } from '@unihelp/contratos';
import { ErrorApi } from '../http/error-api';

/**
 * Los sistemas universitarios que este backend emula, en orden binario de
 * codigo (RM-10). Son exactamente los cuatro que consultan las 40 tareas de
 * `docs/tasks` en su bloque `estado_inicial.servicios`.
 *
 * La lista esta escrita aqui porque cada sistema tiene su propia RUTA y las
 * rutas de NestJS son estaticas. No es una segunda fuente de datos: el estado
 * sale siempre de la base de conocimiento, y `CatalogoSistemas` falla al
 * arrancar si esta lista y la semilla dejan de coincidir.
 */
export const SISTEMAS_EMULADOS = [
  'aula_virtual',
  'autenticacion',
  'correo_institucional',
  'matricula',
] as const;

export type SistemaEmulado = (typeof SISTEMAS_EMULADOS)[number];

/**
 * Catalogo de los sistemas emulados, leido de la base de conocimiento una sola
 * vez. Verifica en los DOS sentidos que la lista de arriba y la semilla dicen
 * lo mismo: un sistema declarado que no existe en la base seria una ruta que
 * responde 500, y un servicio de la base sin declarar seria un sistema que las
 * tareas consultan y el simulador no emula. Las dos situaciones tienen que
 * romper de inmediato y no en mitad de una corrida.
 */
@Injectable()
export class CatalogoSistemas {
  private catalogo: Promise<readonly SistemaEmuladoDto[]> | null = null;

  constructor(@Inject(ListarServiciosUseCase) private readonly listar: ListarServiciosUseCase) {}

  async todos(): Promise<readonly SistemaEmuladoDto[]> {
    this.catalogo ??= this.construir().catch((fallo: unknown) => {
      // Sin cachear el fallo: si la base todavia no estaba sembrada, la
      // siguiente peticion vuelve a intentarlo.
      this.catalogo = null;
      throw fallo;
    });
    return this.catalogo;
  }

  /** @throws ErrorApi 404 si el codigo no es uno de los sistemas emulados. */
  async buscar(codigo: string): Promise<SistemaEmuladoDto> {
    const sistema = (await this.todos()).find((s) => s.codigo === codigo);
    if (sistema === undefined) {
      throw new ErrorApi(
        'no-encontrado',
        `El simulador no emula ningún sistema con el código «${codigo}».`,
        { sistemasEmulados: SISTEMAS_EMULADOS.join(', ') },
      );
    }
    return sistema;
  }

  private async construir(): Promise<readonly SistemaEmuladoDto[]> {
    const servicios = await this.listar.ejecutar();
    const enLaBase = new Set(servicios.map((servicio) => servicio.codigo));
    const faltantes = SISTEMAS_EMULADOS.filter((codigo) => !enLaBase.has(codigo));
    if (faltantes.length > 0) {
      throw new ErrorApi(
        'interno',
        `La base de conocimiento no tiene estos sistemas emulados: ${faltantes.join(', ')}. ¿Está sembrada?`,
      );
    }
    const declarados = new Set<string>(SISTEMAS_EMULADOS);
    const sinDeclarar = servicios
      .map((servicio) => servicio.codigo)
      .filter((codigo) => !declarados.has(codigo));
    if (sinDeclarar.length > 0) {
      throw new ErrorApi(
        'interno',
        `La semilla trae servicios que el simulador no emula: ${sinDeclarar.join(', ')}. Agrégalos a SISTEMAS_EMULADOS.`,
      );
    }
    // `ListarServiciosUseCase` ya ordena por codigo en orden binario (RM-10).
    return servicios.map(aSistemaDto);
  }
}

function aSistemaDto(servicio: Servicio): SistemaEmuladoDto {
  return {
    codigo: servicio.codigo,
    nombre: servicio.nombre,
    area: servicio.area,
    unidadResponsable: servicio.unidadResponsable,
    nivelServicio: servicio.nivelServicio,
    ruta: rutaPropiaDeSistema(servicio.codigo),
  };
}

import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConsultarDisponibilidadSoporteCapacidad, RegistroCapacidades } from '@unihelp/capacidades';
import { DEFINICION_DISPONIBILIDAD_SOPORTE } from '@unihelp/herramientas';

/**
 * Registra las herramientas adicionales (hoy, la sexta:
 * `consultar_disponibilidad_soporte`, HU-43) con el mecanismo aditivo del
 * registro (HU-27), sin tocar las cinco del contrato. El servidor solo las
 * publica y deja invocar a los roles con permiso (`PERMISOS_HERRAMIENTAS_ADICIONALES`),
 * asi el `tools/list` sin rol que descubre B1 sigue siendo la instantanea.
 */
@Injectable()
export class HerramientasAdicionales implements OnModuleInit {
  constructor(
    @Inject(RegistroCapacidades) private readonly registro: RegistroCapacidades,
    @Inject(ConsultarDisponibilidadSoporteCapacidad)
    private readonly disponibilidad: ConsultarDisponibilidadSoporteCapacidad,
  ) {}

  onModuleInit(): void {
    if (this.registro.definicion(DEFINICION_DISPONIBILIDAD_SOPORTE.nombre) === undefined) {
      this.registro.agregar(DEFINICION_DISPONIBILIDAD_SOPORTE, this.disponibilidad);
    }
  }
}

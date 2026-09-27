import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConsultarDisponibilidadSoporteCapacidad, RegistroCapacidades } from '@unihelp/capacidades';
import { DEFINICION_DISPONIBILIDAD_SOPORTE } from '@unihelp/herramientas';

/**
 * Agrega al registro las herramientas que publica SOLO este servidor, por la
 * via aditiva de HU-27: la sexta, `consultar_disponibilidad_soporte` (HU-43).
 * No toca las cinco del contrato ni `CapacidadesModule`, asi que B0 sigue
 * ofreciendo cinco. B1 la descubre por `tools/list`; los agentes de B2 y B3 la
 * descartan porque su rol no la tiene en `PERMISOS_AGENTE`.
 */
export function agregarHerramientasAdicionales(registro: RegistroCapacidades): void {
  if (registro.definicion(DEFINICION_DISPONIBILIDAD_SOPORTE.nombre) === undefined) {
    registro.agregar(
      DEFINICION_DISPONIBILIDAD_SOPORTE,
      new ConsultarDisponibilidadSoporteCapacidad(),
    );
  }
}

/** Hace el registro al arrancar el modulo, antes de abrir cualquier sesion MCP. */
@Injectable()
export class HerramientasAdicionales implements OnModuleInit {
  private readonly logger = new Logger('MCP');

  constructor(@Inject(RegistroCapacidades) private readonly registro: RegistroCapacidades) {}

  onModuleInit(): void {
    agregarHerramientasAdicionales(this.registro);
    this.logger.log(
      `Herramienta adicional publicada: ${DEFINICION_DISPONIBILIDAD_SOPORTE.nombre} (HU-43).`,
    );
  }
}

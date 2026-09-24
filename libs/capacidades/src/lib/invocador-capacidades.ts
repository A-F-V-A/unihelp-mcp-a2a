import { Inject, Injectable } from '@nestjs/common';
import {
  type ContextoInvocacion,
  EjecutorCapacidad,
  ErrorHerramienta,
  type ResultadoCapacidad,
} from '@unihelp/herramientas';
import { RegistroCapacidades } from './registro-capacidades';

/**
 * Puerta de entrada del RECEPTOR de una capacidad, sea quien sea el emisor:
 * busca la implementacion en el registro y la ejecuta a traves de
 * `EjecutorCapacidad` (limite de llamadas, validacion, `dur`, auditoria). B0 lo
 * llama desde el mismo proceso y `mcp-server` desde el manejador de
 * `tools/call`: asi `tool_exec_ms` y los errores tipados se producen con el
 * mismo codigo en ambas arquitecturas (M4.2, RNF-01). Nunca lanza por un fallo
 * de negocio: devuelve el error tipado.
 */
@Injectable()
export class InvocadorCapacidades {
  constructor(
    @Inject(RegistroCapacidades) private readonly registro: RegistroCapacidades,
    @Inject(EjecutorCapacidad) private readonly ejecutor: EjecutorCapacidad,
  ) {}

  invocar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
  ): Promise<ResultadoCapacidad> {
    const capacidad = this.registro.capacidad(nombre);
    return this.ejecutor.ejecutar(
      nombre,
      argumentos,
      contexto,
      capacidad
        ? (a, c) => capacidad.ejecutar(a, c)
        : async () => {
            throw new ErrorHerramienta(
              'VALIDACION_ENTRADA',
              `La herramienta «${nombre}» no existe.`,
            );
          },
    );
  }
}

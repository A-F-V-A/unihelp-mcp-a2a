import { Inject, Injectable } from '@nestjs/common';
import {
  type ContextoInvocacion,
  EjecutorCapacidad,
  ErrorHerramienta,
  type ResultadoCapacidad,
  ahoraMonotonoMs,
} from '@unihelp/herramientas';
import { RegistroCapacidades } from './registro-capacidades';

/** Resultado de una invocacion con su ida y vuelta, para `transport_ms = rtt - dur` (D5). */
export type ResultadoInvocacion = ResultadoCapacidad & { readonly rttMs: number };

/**
 * Entrega una invocacion al adaptador local y mide su ida y vuelta. Es el
 * equivalente EXACTO del cliente MCP de B1, y la unica clase de B0 que B1
 * reemplaza: aqui la llamada no sale del proceso. La resta `rtt - dur` se mide
 * igual que en B1, aunque en B0 sea pequena; nunca se fija en cero (M4.2).
 */
@Injectable()
export class TransporteHerramientasLocal {
  constructor(
    @Inject(RegistroCapacidades) private readonly registro: RegistroCapacidades,
    @Inject(EjecutorCapacidad) private readonly ejecutor: EjecutorCapacidad,
  ) {}

  async invocar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
  ): Promise<ResultadoInvocacion> {
    const inicio = ahoraMonotonoMs();
    const adaptador = this.registro.adaptador(nombre);
    const resultado = await this.ejecutor.ejecutar(
      nombre,
      argumentos,
      contexto,
      adaptador
        ? (a, c) => adaptador.ejecutar(a, c)
        : async () => {
            throw new ErrorHerramienta(
              'VALIDACION_ENTRADA',
              `La herramienta «${nombre}» no existe.`,
            );
          },
    );
    return { ...resultado, rttMs: ahoraMonotonoMs() - inicio };
  }
}

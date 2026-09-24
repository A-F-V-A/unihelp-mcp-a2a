import { Inject, Injectable } from '@nestjs/common';
import {
  type ContextoInvocacion,
  type DescripcionCapacidad,
  type PuertoCapacidades,
  type ResultadoInvocacion,
  ahoraMonotonoMs,
} from '@unihelp/herramientas';
import { InvocadorCapacidades } from './invocador-capacidades';
import { RegistroCapacidades } from './registro-capacidades';

/**
 * Deja un valor tal como quedaria tras viajar por la red (JSON): fechas como
 * ISO 8601, sin `undefined`. Se aplica al resultado para que la traza y el
 * ensamblado de la respuesta vean EXACTAMENTE la misma forma en B0 que en B1,
 * donde el resultado llega serializado (RNF-01).
 */
export function comoTrasViajar<T>(valor: T): T {
  return valor === undefined ? valor : (JSON.parse(JSON.stringify(valor)) as T);
}

/**
 * Implementacion EN PROCESO del puerto de capacidades: la que usa B0 (y usara
 * B2). Es el equivalente exacto del cliente MCP de B1 y la unica pieza que B1
 * reemplaza: aqui la llamada no sale del proceso. La resta `rtt - dur` se mide
 * igual que en B1, aunque en B0 sea pequena; nunca se fija en cero (M4.2, D5).
 */
@Injectable()
export class CapacidadesLocales implements PuertoCapacidades {
  constructor(
    @Inject(RegistroCapacidades) private readonly registro: RegistroCapacidades,
    @Inject(InvocadorCapacidades) private readonly invocador: InvocadorCapacidades,
  ) {}

  async listar(): Promise<readonly DescripcionCapacidad[]> {
    return this.registro.definiciones.map((d) => ({
      nombre: d.nombre,
      descripcion: d.descripcion,
      esquemaEntrada: d.esquemaEntrada,
    }));
  }

  async invocar(
    nombre: string,
    argumentos: unknown,
    contexto: ContextoInvocacion,
  ): Promise<ResultadoInvocacion> {
    const inicio = ahoraMonotonoMs();
    const resultado = await this.invocador.invocar(nombre, argumentos, contexto);
    const rttMs = ahoraMonotonoMs() - inicio;
    if (!resultado.ok) {
      return { ...resultado, rttMs };
    }
    return {
      ...resultado,
      salida: {
        paraModelo: comoTrasViajar(resultado.salida.paraModelo),
        estructurado: comoTrasViajar(resultado.salida.estructurado),
      },
      rttMs,
    };
  }
}

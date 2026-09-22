import { Inject, Injectable } from '@nestjs/common';
import { BuscarPoliticaUseCase } from '@unihelp/conocimiento';
import {
  type ContextoInvocacion,
  envolverContenidoRecuperado,
  marcadorDeEjecucion,
  type SalidaCapacidad,
} from '@unihelp/herramientas';
import type { AdaptadorHerramienta } from './adaptador';

/** `buscar_politica` sobre la busqueda lexica determinista compartida (HU-05 a HU-08). */
@Injectable()
export class AdaptadorBuscarPolitica implements AdaptadorHerramienta {
  readonly nombre = 'buscar_politica';

  constructor(@Inject(BuscarPoliticaUseCase) private readonly buscar: BuscarPoliticaUseCase) {}

  async ejecutar(
    argumentos: Record<string, unknown>,
    contexto: ContextoInvocacion,
  ): Promise<SalidaCapacidad> {
    const resultado = await this.buscar.ejecutar({
      texto: String(argumentos['consulta']),
      servicio: (argumentos['servicio'] as string | undefined) ?? null,
      categoria: (argumentos['categoria'] as string | undefined) ?? null,
    });
    const maximo = Number(argumentos['max_resultados'] ?? 3);
    const politicas = resultado.tipo === 'encontradas' ? resultado.politicas.slice(0, maximo) : [];
    const marcador = marcadorDeEjecucion(contexto.traceId);

    return {
      paraModelo: {
        resultados: politicas.map((p) => ({
          codigo: p.codigo,
          titulo: p.titulo,
          version: p.version,
          extracto: envolverContenidoRecuperado(
            { origen: `política ${p.codigo} v${p.version}`, texto: p.extracto.texto },
            marcador,
          ),
          span: [p.extracto.inicio, p.extracto.fin],
          relevancia: p.relevancia,
          servicios: p.servicios,
        })),
        total_encontrados: politicas.length,
        consulta_normalizada: resultado.consultaNormalizada,
        motivo_sin_resultados: resultado.tipo === 'sin-resultados' ? resultado.motivo : null,
      },
      estructurado: { ...resultado, politicas },
    };
  }
}

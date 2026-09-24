import { Injectable, Logger } from '@nestjs/common';
import type { A2aArtifactDto, ArtefactoPoliticaAplicableDataDto } from '@unihelp/contratos';
import { CapacidadesMcpConocimiento } from '../capacidades-mcp/capacidades-mcp-conocimiento';

/**
 * Servicio que ejecuta la habilidad `knowledge_lookup` para el especialista de conocimiento (HU-05, HU-30).
 *
 * Consulta el grafo de politicas institucionales a traves del servidor MCP y empaqueta
 * el resultado en el artefacto estructurado `politica_aplicable` (doc 03 §4.1).
 */
@Injectable()
export class KnowledgeLookupService {
  private readonly logger = new Logger(KnowledgeLookupService.name);

  constructor(private readonly capacidadesMcp: CapacidadesMcpConocimiento) {}

  /**
   * Ejecuta la busqueda de politica institucional para la consulta dada.
   */
  async ejecutarLookup(
    consulta: string,
    traceId?: string,
  ): Promise<{
    artefacto: A2aArtifactDto<ArtefactoPoliticaAplicableDataDto>;
    durMs: number;
    rttMs: number;
  }> {
    this.logger.log(`Ejecutando lookup de politica: «${consulta.slice(0, 60)}...»`);

    const resultado = await this.capacidadesMcp.buscarPolitica(consulta, traceId);

    const artefacto: A2aArtifactDto<ArtefactoPoliticaAplicableDataDto> = {
      artifactId: 'politica_aplicable',
      name: 'Política aplicable',
      parts: [
        {
          kind: 'data',
          data: resultado.artefacto,
        },
      ],
    };

    return {
      artefacto,
      durMs: resultado.durMs,
      rttMs: resultado.rttMs,
    };
  }
}

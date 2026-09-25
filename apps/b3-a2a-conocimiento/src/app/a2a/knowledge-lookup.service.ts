import { Inject, Injectable, Logger } from '@nestjs/common';
import type { A2aArtifactDto, ArtefactoPoliticaAplicableDataDto } from '@unihelp/contratos';
import { CapacidadesMcpConocimiento } from '../capacidades-mcp/capacidades-mcp-conocimiento';

function extraerTerminosClave(texto: string): string {
  const palabrasVacias = new Set([
    'cual',
    'cuales',
    'que',
    'como',
    'donde',
    'cuando',
    'quien',
    'la',
    'el',
    'los',
    'las',
    'un',
    'una',
    'unos',
    'unas',
    'de',
    'del',
    'a',
    'al',
    'en',
    'para',
    'por',
    'con',
    'sin',
    'sobre',
    'politica',
    'politicas',
    'institucional',
    'institucionales',
    'procedimiento',
    'procedimientos',
    'es',
    'son',
    'seria',
    'serian',
    'tengo',
    'tiene',
    'hay',
    'dice',
    'establece',
    'mi',
    'mis',
    'su',
    'sus',
    'y',
    'o',
    'e',
    'u',
    'favor',
    'ayuda',
  ]);

  const limpio = texto
    .toLowerCase()
    .replace(/[¿?¡!.,;:()"\-_]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const tokens = limpio.split(/\s+/).filter((t) => t.length > 2 && !palabrasVacias.has(t));
  return tokens.slice(0, 3).join(' ');
}

/**
 * Servicio que ejecuta la habilidad `knowledge_lookup` para el especialista de conocimiento (HU-05, HU-30).
 *
 * Consulta el grafo de politicas institucionales a traves del servidor MCP y empaqueta
 * el resultado en el artefacto estructurado `politica_aplicable` (doc 03 §4.1).
 */
@Injectable()
export class KnowledgeLookupService {
  private readonly logger = new Logger(KnowledgeLookupService.name);

  constructor(
    @Inject(CapacidadesMcpConocimiento)
    private readonly capacidadesMcp: CapacidadesMcpConocimiento,
  ) {}

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

    let resultado = await this.capacidadesMcp.buscarPolitica(consulta, traceId);

    // Si una pregunta en lenguaje natural diluye la relevancia lexica ts_rank por debajo del
    // umbral, reintentamos extrayendo los terminos clave directos (HU-05, HU-08).
    if (resultado.artefacto.sin_resultados) {
      const terminos = extraerTerminosClave(consulta);
      if (terminos && terminos !== consulta && terminos.length >= 3) {
        this.logger.log(`Reintentando lookup con terminos clave: «${terminos}»`);
        const segundo = await this.capacidadesMcp.buscarPolitica(terminos, traceId);
        if (!segundo.artefacto.sin_resultados) {
          resultado = segundo;
        }
      }
    }

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

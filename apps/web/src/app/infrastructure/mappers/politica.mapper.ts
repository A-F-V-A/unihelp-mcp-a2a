import type { CitaPoliticaDto, PoliticaDto } from '@unihelp/contratos';
import type { CitaPolitica, Politica } from '../../domain/models/politica';

export function mapearCitaPolitica(dto: CitaPoliticaDto): CitaPolitica {
  return {
    codigo: dto.codigo,
    version: dto.version,
    titulo: dto.titulo,
    extracto: dto.extracto,
    area: dto.area,
  };
}

export function mapearPolitica(dto: PoliticaDto): Politica {
  return {
    ...mapearCitaPolitica(dto),
    contenido: [...dto.contenido],
    vigenteDesde: new Date(dto.vigenteDesde),
    dependenciaResponsable: dto.dependenciaResponsable,
    enlace: dto.enlace,
  };
}

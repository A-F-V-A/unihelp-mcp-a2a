import type { AreaServicio } from '@unihelp/dominio';

/** Cita de una politica institucional dentro de una respuesta (HU-05, HU-06). */
export interface CitaPoliticaDto {
  /** Codigo estable de la politica. Ej.: `PA-REG-012`. */
  readonly codigo: string;
  /** Version citada. Ej.: `3.1`. */
  readonly version: string;
  readonly titulo: string;
  /** Fragmento que sustenta la respuesta. */
  readonly extracto: string;
  readonly area: AreaServicio;
}

/** Politica completa: `GET /api/politicas/:codigo?version=`. */
export interface PoliticaDto extends CitaPoliticaDto {
  /** Texto de la politica, un elemento por parrafo o numeral. */
  readonly contenido: readonly string[];
  /** Fecha de entrada en vigencia de esta version, ISO 8601. */
  readonly vigenteDesde: string;
  readonly dependenciaResponsable: string;
  /** Enlace al documento oficial, si esta publicado. */
  readonly enlace: string | null;
}

import type { AreaServicio } from '@unihelp/dominio';

/** Politica citada dentro de una respuesta. Codigo y version siempre presentes. */
export interface CitaPolitica {
  readonly codigo: string;
  readonly version: string;
  readonly titulo: string;
  readonly extracto: string;
  readonly area: AreaServicio;
}

/** Politica completa, para verificarla o citarla despues. */
export interface Politica extends CitaPolitica {
  readonly contenido: readonly string[];
  readonly vigenteDesde: Date;
  readonly dependenciaResponsable: string;
  readonly enlace: string | null;
}

export interface ConsultaPolitica {
  readonly codigo: string;
  /** Sin version se obtiene la vigente. */
  readonly version?: string;
}

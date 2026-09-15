/** Tema de una politica (acceso, plazos, soporte...). Permite listar las politicas que aplican a un tema (HU-09, HU-10). */
export interface Categoria {
  /** Codigo estable en snake_case, el mismo del esquema de `buscar_politica` (docs/02). Ej.: `datos_personales`. */
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string;
}

import type { ProveedorModelo } from '@unihelp/dominio';

/**
 * Configuracion del modelo de lenguaje vista desde la interfaz.
 *
 * La clave del proveedor vive SIEMPRE en el backend: nunca viaja al navegador
 * ni desde el. La pantalla solo elige entre lo que el backend declara
 * disponible, y por eso el catalogo lo publica el backend y no el frontend
 * (decision 27).
 */
export interface ProveedorModeloDto {
  readonly id: ProveedorModelo;
  readonly nombre: string;
  readonly descripcion: string;
  /** `false` si el backend no lo implementa o no tiene su clave configurada. */
  readonly disponible: boolean;
  /** Por que no se puede usar todavia. `null` cuando `disponible` es `true`. */
  readonly motivoNoDisponible: string | null;
  /** Modelos que el backend admite para este proveedor, con su fecha de snapshot. */
  readonly modelos: readonly string[];
  /** El que se usa si no se elige otro. `null` si el proveedor no esta disponible. */
  readonly modeloPorDefecto: string | null;
}

/** Lo que la persona elige en la pantalla de configuracion. */
export interface SeleccionModeloIaDto {
  readonly proveedor: ProveedorModelo;
  /** Debe ser uno de los `modelos` del proveedor elegido. */
  readonly modelo: string;
}

/** `GET` y `PUT` de {@link RUTAS_API.modeloIa}. */
export interface ConfiguracionModeloIaDto {
  readonly proveedores: readonly ProveedorModeloDto[];
  readonly seleccion: SeleccionModeloIaDto;
  /** Si el backend tiene la clave del proveedor elegido. La UI nunca la ve. */
  readonly claveConfigurada: boolean;
  /**
   * `false` cuando el backend no admite cambiar el modelo en ejecucion. Las
   * corridas del experimento ignoran esta eleccion y usan la del ejecutor, para
   * que todas las arquitecturas midan con el mismo modelo (RNF-01, RNF-08).
   */
  readonly editable: boolean;
}

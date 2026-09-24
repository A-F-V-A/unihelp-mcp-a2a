import type { IdentificadorArquitectura } from '@unihelp/dominio';
import type { ModoLlm } from './corrida';

/**
 * `experiment/ejecutor/corrida.yaml` tal como esta en disco: todo lo que puede
 * mover una cifra y viaja a `provenance.config_hash`. El panel lo muestra para
 * que quien prepara una corrida sepa con que se va a correr; no lo modifica
 * (HU-MET-14).
 */
export interface ConfiguracionCorrida {
  readonly semilla: number;
  readonly repeticiones: number;
  readonly arquitecturas: readonly IdentificadorArquitectura[];
  /** `null` = las 40 tareas. */
  readonly tareas: readonly string[] | null;
  readonly modoLlm: ModoLlm;
  readonly backends: Readonly<Partial<Record<IdentificadorArquitectura, string>>>;
  readonly tarifaUsdPorMillon: {
    readonly entrada: number;
    readonly salida: number;
    /** `false` mientras ambas sigan en cero (M4.7, pendiente RM-17). */
    readonly configurada: boolean;
  };
  readonly timeoutHttpS: number;
  readonly verificarFidelidadCitacion: boolean;
  readonly datasetVersion: string;
}

/** Respuesta de `/health` de un backend, reducida a lo que el panel necesita comprobar. */
export interface SaludBackend {
  readonly url: string;
  readonly arquitectura: string;
  readonly servicio: string;
  readonly version: string;
  readonly consultadaEn: Date;
}

import type { IdentificadorArquitectura } from '@unihelp/dominio';

/**
 * `experiment/salidas/resultados.json` ya calculado por el cuaderno de analisis.
 * Es el UNICO contrato del panel con las metricas (decision 19, HU-MET-09):
 * aqui no se deriva ningun numero; se muestran tal cual llegan.
 */

/** Version del contrato que este panel sabe leer. Otra version se declara, no se muestra. */
export const VERSION_RESULTADOS_CONOCIDA = '1.0.0';

export const FAMILIAS_METRICA = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] as const;

export type FamiliaMetrica = (typeof FAMILIAS_METRICA)[number];

export const ROLES_METRICA = ['primaria', 'secundaria', 'descriptiva', 'control'] as const;

export type RolMetrica = (typeof ROLES_METRICA)[number];

export type EstadoMetrica = 'calculada' | 'sin_datos' | 'pendiente';

/**
 * Umbral (tiene valor esperado y se dice si lo alcanza) frente a resultado
 * abierto (NUNCA lleva aprobado/reprobado). Distincion que no se puede borrar
 * (HU-MET-03, RM-14).
 */
export type TipoValorEsperado = 'umbral' | 'resultado_abierto';

export type DireccionMetrica = 'mayor_es_mejor' | 'menor_es_mejor' | 'sin_direccion';

export interface IntervaloConfianza {
  readonly inferior: number;
  readonly superior: number;
  readonly nivel: number;
}

export interface FilaMetrica {
  /** `null` cuando el valor es global (corrida completa, transporte, muestra). */
  readonly arquitectura: IdentificadorArquitectura | null;
  /** Desglose: categoria, componente, tipo_fallo, transporte, tokens... */
  readonly dimensiones: Readonly<Record<string, string>>;
  readonly estadistico: string;
  readonly valor: number | null;
  readonly intervalo: IntervaloConfianza | null;
  readonly nTareas: number | null;
  readonly nObservaciones: number | null;
}

/** Diferencia pareada por tarea (minuendo - sustraendo). Estimacion con intervalo, SIN decision. */
export interface ContrasteMetrica {
  readonly minuendo: IdentificadorArquitectura;
  readonly sustraendo: IdentificadorArquitectura;
  readonly dimensiones: Readonly<Record<string, string>>;
  readonly estadistico: string;
  readonly diferencia: number | null;
  readonly intervalo: IntervaloConfianza | null;
  readonly nTareas: number;
}

export type OperadorUmbral = '>=' | '<=' | '<' | '>' | '==' | 'igual_entre_arquitecturas';

export interface UmbralMetrica {
  readonly operador: OperadorUmbral;
  readonly valor: number | null;
  readonly arquitecturas: readonly IdentificadorArquitectura[] | null;
  readonly alcance: string | null;
  readonly descripcion: string;
  readonly consecuencia: string | null;
  /** Lo que se comparo: un numero global o un valor por arquitectura. */
  readonly observado: number | Readonly<Record<string, number | null>> | null;
  /** `null` si no se pudo evaluar. Lo decidio el cuaderno, no el panel. */
  readonly alcanza: boolean | null;
}

export interface MetricaResultado {
  readonly codigo: string;
  readonly familia: FamiliaMetrica;
  readonly nombre: string;
  readonly rol: RolMetrica;
  readonly hipotesis: readonly string[];
  readonly tipoValorEsperado: TipoValorEsperado;
  readonly unidad: string;
  readonly direccion: DireccionMetrica;
  readonly unidadAnalisis: string;
  readonly estado: EstadoMetrica;
  readonly motivoEstado: string | null;
  readonly filas: readonly FilaMetrica[];
  readonly contrastes: readonly ContrasteMetrica[];
  readonly notas: readonly string[];
  /** Solo existe si `tipoValorEsperado` es `umbral`. */
  readonly umbral: UmbralMetrica | null;
}

export interface CorridaAnalizada {
  readonly semilla: number | null;
  readonly versionCodigo: string | null;
  readonly modeloId: string | null;
  readonly versionRegistro: string;
  readonly versionEsquemaTraza: string;
  readonly arquitecturas: readonly IdentificadorArquitectura[];
  readonly tareasTotal: number;
  readonly tareasPorCategoria: Readonly<Record<string, number>>;
  /** Unidad de OBSERVACION: nunca es el tamano de muestra (RM-03). */
  readonly ejecuciones: {
    readonly intentadas: number;
    readonly validas: number;
    readonly invalidas: number;
    readonly porMotivo: Readonly<Record<string, number>>;
  };
  /** Unidad de ANALISIS: `tamanoMuestra` es el numero de tareas que se cita (HU-MET-11). */
  readonly inferencia: {
    readonly tamanoMuestra: number;
    readonly metodo: string;
    readonly replicas: number;
    readonly nivel: number;
    readonly semilla: number;
  };
}

export interface ValidacionAnalisis {
  readonly umbralAvisoResiduo: number;
  readonly avisosResiduo: readonly { readonly ejecucion: string; readonly proporcion: number }[];
  readonly rechazos: readonly {
    readonly origen: string;
    readonly ejecucion: string | null;
    readonly motivos: readonly string[];
    readonly detalle: readonly string[];
  }[];
}

export interface ResultadosAnalisis {
  readonly versionEsquema: string;
  readonly generadoEn: Date;
  readonly corrida: CorridaAnalizada;
  readonly validacion: ValidacionAnalisis;
  readonly metricas: readonly MetricaResultado[];
}

/** Una salida publicada por el cuaderno (`salidas/manifiesto.json`): figura o tabla con su SHA-256. */
export interface SalidaPublicada {
  readonly etiqueta: string;
  readonly archivo: string;
  readonly sha256: string;
  readonly tipo: 'figura' | 'tabla';
}

export interface ManifiestoSalidas {
  readonly resultadosSha256: string;
  readonly salidas: readonly SalidaPublicada[];
}

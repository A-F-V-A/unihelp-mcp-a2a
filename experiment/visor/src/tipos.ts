/**
 * Tipos del visor en vivo. Los nombres de los campos de la traza parcial son los
 * de `experiment/schemas/traza.schema.json`, via `@unihelp/contratos`.
 */
import type { TrazaParcialDto } from '@unihelp/contratos';

export type CondicionDeEnvio = 'agente_pidio_confirmacion';

export interface TurnoTarea {
  readonly texto: string;
  /** `null` = se envia siempre; con condicion, solo si el agente propuso (docs/tasks/_ESTRUCTURA.md). */
  readonly condicionDeEnvio: CondicionDeEnvio | null;
}

/** Lo que la tarea espera, resumido para el panel. La compuerta la aplica Python, no el visor. */
export interface EsperadoResumen {
  readonly clasificacion: string;
  readonly herramientasObligatorias: readonly string[];
  readonly herramientasProhibidas: readonly string[];
  readonly politicasRequeridas: readonly string[];
  readonly confirmacionRequerida: boolean;
  readonly ticketDebeCrearse: boolean;
}

export interface TareaVisor {
  readonly id: string;
  readonly categoria: string;
  readonly titulo: string;
  readonly arquitecturas: readonly string[];
  readonly overlay: string;
  readonly corpus: 'estandar' | 'adversarial';
  readonly turnos: readonly TurnoTarea[];
  readonly esperado: EsperadoResumen;
  readonly maxTurnosAgente: number;
  readonly timeoutS: number;
  readonly vectorAdversarial: string | null;
}

export interface ConfiguracionPersona {
  readonly tecleoMs: readonly [number, number];
  readonly erroresDeTecleo: number;
  readonly pausaAntesDeEscribirMs: number;
  readonly pausaLecturaMs: number;
  readonly pausaLecturaPorCaracterMs: number;
  readonly pausaLecturaMaximaMs: number;
  readonly confirmacion: 'texto' | 'boton';
  readonly pausaFinalMs: number;
  readonly semilla: number;
}

export interface ConfiguracionVisor {
  readonly arquitectura: string;
  readonly backend: string;
  readonly frontend: string;
  readonly tareas: readonly string[] | null;
  readonly repeticiones: number;
  readonly persona: ConfiguracionPersona;
  readonly entorno: {
    readonly restablecer: boolean;
    readonly verificarHuella: boolean;
    readonly enviarTraceId: boolean;
  };
  readonly medicion: {
    readonly habilitada: boolean;
    readonly compuerta: boolean;
    readonly fallarSiRepruebaCompuerta: boolean;
  };
  readonly navegador: {
    readonly ancho: number;
    readonly alto: number;
    readonly visible: boolean;
    readonly camaraLentaMs: number;
  };
  readonly panel: { readonly visible: boolean; readonly ancho: number };
  readonly tiempoMaximoTurnoS: number;
  readonly salidas: {
    /** Absoluto, ya resuelto. */
    readonly directorio: string;
    readonly video: boolean;
    readonly trazaPlaywright: 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
  };
}

/** Un turno tal como ocurrio, en el formato de `conversation[]` de la traza. */
export interface TurnoObservado {
  readonly turno: number;
  readonly rol: 'usuario' | 'agente';
  readonly texto: string;
}

/**
 * Lo que el visor observo de UNA ejecucion. Es la entrada de
 * `uv run python -m ejecutor puntuar-observacion` e `importar-visor`: Python arma
 * la traza y aplica la compuerta con el mismo codigo que el ejecutor.
 */
export interface Observacion {
  readonly version: 1;
  readonly origen: 'visor';
  readonly run_id: string;
  readonly trace_id: string;
  readonly task_id: string;
  readonly condicion: string;
  readonly repeticion: number;
  readonly huella_estado: string;
  readonly huella_esperada: string | null;
  readonly entorno_restablecido: boolean;
  readonly inicio_iso: string;
  readonly fin_iso: string;
  readonly conversacion: readonly TurnoObservado[];
  readonly parcial: TrazaParcialDto | null;
  readonly errores: readonly { readonly tipo: string; readonly mensaje: string }[];
  /** `error_infraestructura` cuando la ejecucion no llego a medirse (RM-15); si no, `null`. */
  readonly estado_forzado: 'error_infraestructura' | null;
  readonly persona: { readonly confirmacion: 'texto' | 'boton'; readonly semilla: number };
}

/** Veredicto de la compuerta automatica, tal como lo imprime Python. */
export interface VeredictoCompuerta {
  readonly run_id: string;
  readonly estado: string;
  readonly traza_valida: boolean;
  readonly errores_esquema: readonly string[];
  readonly exito: boolean;
  readonly motivos: readonly string[];
}

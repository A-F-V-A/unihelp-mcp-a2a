import { InjectionToken } from '@angular/core';

export type OperacionSimulada =
  | 'enviarMensaje'
  | 'obtenerHistorial'
  | 'listarConversaciones'
  | 'eliminarConversacion'
  | 'proponerTicket'
  | 'confirmarTicket'
  | 'rechazarTicket'
  | 'buscarPolitica'
  | 'consultarEstado';

/** Fallos de infraestructura que la simulacion puede provocar a proposito. */
export const ERRORES_SIMULABLES = [
  'timeout',
  'validacion',
  'servicio-no-disponible',
  'interno',
] as const;

export type ErrorSimulable = (typeof ERRORES_SIMULABLES)[number];

export interface ConfiguracionSimulacion {
  /** Latencia minima de cada respuesta. */
  readonly latenciaMinimaMs: number;
  /** Latencia maxima de cada respuesta. */
  readonly latenciaMaximaMs: number;
  /** Cuanto "espera" una peticion que termina en timeout. */
  readonly esperaTimeoutMs: number;
  /** Probabilidad (0 a 1) de que cualquier operacion falle con un error aleatorio. */
  readonly probabilidadError: number;
  /** Error que falla SIEMPRE, en todas las operaciones o solo en una. */
  readonly errorForzado: {
    readonly codigo: ErrorSimulable;
    readonly operacion: OperacionSimulada | null;
  } | null;
  /** Limite de turnos por conversacion (RNF-04). */
  readonly turnosMaximos: number;
  /** Conserva la base simulada en `sessionStorage` para sobrevivir a recargas. */
  readonly persistirEnSesion: boolean;
  /** Arranca con conversaciones de dias anteriores para que el historial no este vacio. */
  readonly sembrarConversaciones: boolean;
}

export const CONFIGURACION_SIMULACION_POR_DEFECTO: ConfiguracionSimulacion = {
  latenciaMinimaMs: 300,
  latenciaMaximaMs: 1500,
  esperaTimeoutMs: 4000,
  probabilidadError: 0,
  errorForzado: null,
  turnosMaximos: 8,
  persistirEnSesion: true,
  sembrarConversaciones: true,
};

export const CONFIGURACION_SIMULACION = new InjectionToken<ConfiguracionSimulacion>(
  'CONFIGURACION_SIMULACION',
);

const OPERACIONES: readonly OperacionSimulada[] = [
  'enviarMensaje',
  'obtenerHistorial',
  'listarConversaciones',
  'eliminarConversacion',
  'proponerTicket',
  'confirmarTicket',
  'rechazarTicket',
  'buscarPolitica',
  'consultarEstado',
];

const esErrorSimulable = (valor: string | null): valor is ErrorSimulable =>
  (ERRORES_SIMULABLES as readonly (string | null)[]).includes(valor);

const esOperacion = (valor: string | null): valor is OperacionSimulada =>
  (OPERACIONES as readonly (string | null)[]).includes(valor);

/**
 * Sobrescrituras para probar estados de la UI sin tocar codigo:
 *
 * - `?simular-error=timeout` (o `validacion`, `servicio-no-disponible`, `interno`)
 * - `?simular-error=interno&simular-error-en=confirmarTicket`
 * - `?tasa-error=0.3`
 * - `?turnos-maximos=3`
 */
export function leerSobrescriturasUrl(query: string): Partial<ConfiguracionSimulacion> {
  const params = new URLSearchParams(query);
  const resultado: { -readonly [K in keyof ConfiguracionSimulacion]?: ConfiguracionSimulacion[K] } =
    {};

  const error = params.get('simular-error');
  if (esErrorSimulable(error)) {
    const operacion = params.get('simular-error-en');
    resultado.errorForzado = {
      codigo: error,
      operacion: esOperacion(operacion) ? operacion : null,
    };
  }

  const tasa = Number(params.get('tasa-error'));
  if (params.has('tasa-error') && tasa >= 0 && tasa <= 1) {
    resultado.probabilidadError = tasa;
  }

  const turnos = Number(params.get('turnos-maximos'));
  if (Number.isInteger(turnos) && turnos > 0) {
    resultado.turnosMaximos = turnos;
  }

  return resultado;
}

export function crearConfiguracionSimulacion(
  desdeEntorno: Partial<ConfiguracionSimulacion> = {},
  query = '',
): ConfiguracionSimulacion {
  return {
    ...CONFIGURACION_SIMULACION_POR_DEFECTO,
    ...desdeEntorno,
    ...leerSobrescriturasUrl(query),
  };
}

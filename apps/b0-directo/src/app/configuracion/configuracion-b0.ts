/**
 * Configuracion de B0, leida del entorno al arrancar. Una variable obligatoria
 * que falta o no es valida hace FALLAR el arranque: nunca se ejecuta con un
 * valor supuesto (mismo criterio que `resolverConfiguracionConocimiento`).
 * Detalle en `apps/b0-directo/docs/ARQUITECTURA.md`, seccion 11.
 */

export const MODOS_LLM = ['live', 'record', 'replay'] as const;

export type ModoLlm = (typeof MODOS_LLM)[number];

export interface ConfiguracionModelo {
  readonly proveedor: 'openai';
  /** Identificador exacto con fecha de snapshot. Va a cada traza (RNF-08). */
  readonly id: string;
  readonly temperatura: number;
  readonly topP: number;
  readonly maxTokens: number;
}

export interface ConfiguracionB0 {
  readonly modelo: ConfiguracionModelo;
  /** `null` en `replay`: la reproduccion no requiere credenciales (HU-44). */
  readonly claveApi: string | null;
  readonly modoLlm: ModoLlm;
  readonly directorioCasetes: string | null;
  readonly limites: {
    /** Tiempo de procesamiento por conversacion, sin la espera entre turnos (RNF-04). */
    readonly tiempoMs: number;
    /** Turnos de la persona por conversacion (HU-04, `TurnosDto.maximos`). */
    readonly turnos: number;
    /** Llamadas a herramientas por conversacion (RNF-04; docs/02, 5). */
    readonly llamadasHerramienta: number;
  };
}

export const CONFIGURACION_B0 = Symbol('CONFIGURACION_B0');

type Entorno = Readonly<Record<string, string | undefined>>;

export class ConfiguracionB0InvalidaError extends Error {}

function obligatoria(entorno: Entorno, nombre: string): string {
  const valor = entorno[nombre]?.trim();
  if (!valor) {
    throw new ConfiguracionB0InvalidaError(`Falta la variable de entorno ${nombre}.`);
  }
  return valor;
}

function numero(
  entorno: Entorno,
  nombre: string,
  porDefecto: number,
  valido: (n: number) => boolean,
): number {
  const crudo = entorno[nombre]?.trim();
  const valor = crudo ? Number(crudo) : porDefecto;
  if (!Number.isFinite(valor) || !valido(valor)) {
    throw new ConfiguracionB0InvalidaError(`${nombre} no es válida: «${crudo}».`);
  }
  return valor;
}

export function leerConfiguracionB0(entorno: Entorno = process.env): ConfiguracionB0 {
  const proveedor = obligatoria(entorno, 'UNIHELP_MODELO_PROVEEDOR');
  if (proveedor !== 'openai') {
    throw new ConfiguracionB0InvalidaError(
      `UNIHELP_MODELO_PROVEEDOR=«${proveedor}» no está soportado; solo «openai».`,
    );
  }
  const modoLlm = obligatoria(entorno, 'UNIHELP_MODO_LLM');
  if (!(MODOS_LLM as readonly string[]).includes(modoLlm)) {
    throw new ConfiguracionB0InvalidaError(
      `UNIHELP_MODO_LLM debe ser ${MODOS_LLM.join(', ')}; se recibió «${modoLlm}».`,
    );
  }
  const modo = modoLlm as ModoLlm;
  const directorioCasetes =
    modo === 'live' ? null : obligatoria(entorno, 'UNIHELP_DIRECTORIO_CASETES');
  const claveApi = modo === 'replay' ? null : obligatoria(entorno, 'OPENAI_API_KEY');
  const positivo = (n: number) => n > 0;

  return {
    modelo: {
      proveedor,
      id: obligatoria(entorno, 'UNIHELP_MODELO_ID'),
      // Valores por defecto de docs/07, seccion 2.
      temperatura: numero(entorno, 'UNIHELP_MODELO_TEMPERATURA', 0.2, (n) => n >= 0 && n <= 2),
      topP: numero(entorno, 'UNIHELP_MODELO_TOP_P', 1, (n) => n > 0 && n <= 1),
      maxTokens: numero(entorno, 'UNIHELP_MODELO_MAX_TOKENS', 2048, positivo),
    },
    claveApi,
    modoLlm: modo,
    directorioCasetes,
    limites: {
      tiempoMs: numero(entorno, 'UNIHELP_LIMITE_TIEMPO_MS', 120_000, positivo),
      turnos: numero(entorno, 'UNIHELP_LIMITE_TURNOS', 8, positivo),
      llamadasHerramienta: numero(entorno, 'UNIHELP_LIMITE_LLAMADAS_HERRAMIENTA', 20, positivo),
    },
  };
}

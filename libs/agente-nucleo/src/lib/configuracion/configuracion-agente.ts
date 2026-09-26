/**
 * Configuracion del agente unico (B0 y B1), leida del entorno al arrancar. Una
 * variable obligatoria que falta o no es valida hace FALLAR el arranque: nunca
 * se ejecuta con un valor supuesto (mismo criterio que
 * `resolverConfiguracionConocimiento`). Es la MISMA lectura en las dos
 * arquitecturas: modelo, muestreo y limites no pueden diferir (RNF-01).
 * Detalle en `apps/b0-directo/docs/ARQUITECTURA.md`, seccion 11.
 */

export const MODOS_LLM = ['live', 'record', 'replay'] as const;

export type ModoLlm = (typeof MODOS_LLM)[number];

/**
 * Esfuerzo de razonamiento que se pide al proveedor. `none` es el unico con el
 * que los modelos GPT-5.x aceptan `temperature` y herramientas en Chat
 * Completions (decisiones 23 y 40); con otro valor la temperatura de docs/07
 * deja de aplicar y el proveedor exige la API de respuestas.
 */
export const ESFUERZOS_RAZONAMIENTO = ['none', 'low', 'medium', 'high'] as const;

export type EsfuerzoRazonamiento = (typeof ESFUERZOS_RAZONAMIENTO)[number];

/**
 * Proveedores que el backend sabe invocar. Ambos hablan la API de Chat
 * Completions con function calling: `ollama` sirve un modelo local en esta
 * maquina por la misma API, sin credencial (decision 46).
 */
export const PROVEEDORES_MODELO_BACKEND = ['openai', 'ollama'] as const;

export type ProveedorModeloBackend = (typeof PROVEEDORES_MODELO_BACKEND)[number];

/** Donde escucha Ollama por defecto; `/v1` es su prefijo compatible con OpenAI. */
export const URL_BASE_OLLAMA = 'http://localhost:11434/v1';

export interface ConfiguracionModelo {
  readonly proveedor: ProveedorModeloBackend;
  /**
   * URL base del proveedor, o `null` para la de OpenAI. Con `ollama` siempre
   * hay una: `UNIHELP_MODELO_URL_BASE` o, si falta, `URL_BASE_OLLAMA`.
   */
  readonly urlBase: string | null;
  /** Identificador exacto con fecha de snapshot. Va a cada traza (RNF-08). */
  readonly id: string;
  readonly temperatura: number;
  readonly topP: number;
  readonly maxTokens: number;
  readonly esfuerzoRazonamiento: EsfuerzoRazonamiento;
}

export interface ConfiguracionAgente {
  readonly modelo: ConfiguracionModelo;
  /**
   * Modelos entre los que la pantalla de configuracion puede elegir, todos con
   * su fecha de snapshot (RNF-08). Siempre incluye el de `UNIHELP_MODELO_ID`,
   * que es el unico que usan las corridas del experimento (decision 27).
   */
  readonly modelosPermitidos: readonly string[];
  /**
   * `null` en `replay`: la reproduccion no requiere credenciales (HU-44). Con
   * `ollama` vale `ollama` si no hay `OPENAI_API_KEY`: el servidor local no
   * autentica, pero el SDK exige un valor no vacio.
   */
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

export const CONFIGURACION_AGENTE = Symbol('CONFIGURACION_AGENTE');

type Entorno = Readonly<Record<string, string | undefined>>;

export class ConfiguracionAgenteInvalidaError extends Error {}

function esfuerzo(entorno: Entorno): EsfuerzoRazonamiento {
  const valor = entorno['UNIHELP_MODELO_ESFUERZO']?.trim() || 'none';
  if (!(ESFUERZOS_RAZONAMIENTO as readonly string[]).includes(valor)) {
    throw new ConfiguracionAgenteInvalidaError(
      `UNIHELP_MODELO_ESFUERZO=«${valor}» no es válido; use none, low, medium o high.`,
    );
  }
  return valor as EsfuerzoRazonamiento;
}

function obligatoria(entorno: Entorno, nombre: string): string {
  const valor = entorno[nombre]?.trim();
  if (!valor) {
    throw new ConfiguracionAgenteInvalidaError(`Falta la variable de entorno ${nombre}.`);
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
    throw new ConfiguracionAgenteInvalidaError(`${nombre} no es válida: «${crudo}».`);
  }
  return valor;
}

function urlBase(entorno: Entorno, proveedor: ProveedorModeloBackend): string | null {
  const crudo = entorno['UNIHELP_MODELO_URL_BASE']?.trim();
  const valor = crudo || (proveedor === 'ollama' ? URL_BASE_OLLAMA : null);
  if (valor === null) {
    return null;
  }
  try {
    new URL(valor);
  } catch {
    throw new ConfiguracionAgenteInvalidaError(
      `UNIHELP_MODELO_URL_BASE no es una URL: «${valor}».`,
    );
  }
  return valor;
}

function claveApi(
  entorno: Entorno,
  proveedor: ProveedorModeloBackend,
  modo: ModoLlm,
): string | null {
  if (modo === 'replay') {
    return null;
  }
  if (proveedor === 'ollama') {
    return entorno['OPENAI_API_KEY']?.trim() || 'ollama';
  }
  return obligatoria(entorno, 'OPENAI_API_KEY');
}

export function leerConfiguracionAgente(entorno: Entorno = process.env): ConfiguracionAgente {
  const proveedorCrudo = obligatoria(entorno, 'UNIHELP_MODELO_PROVEEDOR');
  if (!(PROVEEDORES_MODELO_BACKEND as readonly string[]).includes(proveedorCrudo)) {
    throw new ConfiguracionAgenteInvalidaError(
      `UNIHELP_MODELO_PROVEEDOR=«${proveedorCrudo}» no está soportado; use ${PROVEEDORES_MODELO_BACKEND.join(', ')}.`,
    );
  }
  const proveedor = proveedorCrudo as ProveedorModeloBackend;
  const modoLlm = obligatoria(entorno, 'UNIHELP_MODO_LLM');
  if (!(MODOS_LLM as readonly string[]).includes(modoLlm)) {
    throw new ConfiguracionAgenteInvalidaError(
      `UNIHELP_MODO_LLM debe ser ${MODOS_LLM.join(', ')}; se recibió «${modoLlm}».`,
    );
  }
  const modo = modoLlm as ModoLlm;
  const directorioCasetes =
    modo === 'live' ? null : obligatoria(entorno, 'UNIHELP_DIRECTORIO_CASETES');
  const positivo = (n: number) => n > 0;

  const modeloId = obligatoria(entorno, 'UNIHELP_MODELO_ID');
  const permitidos = (entorno['UNIHELP_MODELOS_PERMITIDOS'] ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m !== '');

  return {
    modelosPermitidos: [...new Set([modeloId, ...permitidos])],
    modelo: {
      proveedor,
      urlBase: urlBase(entorno, proveedor),
      id: modeloId,
      // Valores por defecto de docs/07, seccion 2.
      temperatura: numero(entorno, 'UNIHELP_MODELO_TEMPERATURA', 0.2, (n) => n >= 0 && n <= 2),
      topP: numero(entorno, 'UNIHELP_MODELO_TOP_P', 1, (n) => n > 0 && n <= 1),
      maxTokens: numero(entorno, 'UNIHELP_MODELO_MAX_TOKENS', 2048, positivo),
      esfuerzoRazonamiento: esfuerzo(entorno),
    },
    claveApi: claveApi(entorno, proveedor, modo),
    modoLlm: modo,
    directorioCasetes,
    limites: {
      tiempoMs: numero(entorno, 'UNIHELP_LIMITE_TIEMPO_MS', 120_000, positivo),
      turnos: numero(entorno, 'UNIHELP_LIMITE_TURNOS', 8, positivo),
      llamadasHerramienta: numero(entorno, 'UNIHELP_LIMITE_LLAMADAS_HERRAMIENTA', 20, positivo),
    },
  };
}

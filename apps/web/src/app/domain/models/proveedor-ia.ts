/**
 * Configuracion de que motor de IA debe responder la conversacion. Hoy es solo
 * una preferencia guardada: el motor simulado sigue respondiendo igual sin
 * importar lo que se elija aqui. Cuando exista un backend real, este es el
 * valor que decidiria a que proveedor enrutar cada mensaje.
 */

export const PROVEEDORES_IA = ['chatgpt', 'gemini', 'claude', 'local'] as const;
export type ProveedorIA = (typeof PROVEEDORES_IA)[number];

/** Ficha de cada proveedor: nombre, modelos sugeridos y si necesita una URL propia. */
export interface DescriptorProveedorIA {
  readonly id: ProveedorIA;
  readonly nombre: string;
  readonly descripcion: string;
  /** Modelos usuales, para sugerir; el campo sigue siendo texto libre. */
  readonly modelosSugeridos: readonly string[];
  /** Solo el agente local necesita que le indiquen donde vive. */
  readonly requiereUrl: boolean;
}

export const CATALOGO_PROVEEDORES_IA: Readonly<Record<ProveedorIA, DescriptorProveedorIA>> = {
  chatgpt: {
    id: 'chatgpt',
    nombre: 'ChatGPT',
    descripcion: 'Modelos GPT de OpenAI.',
    modelosSugeridos: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
    requiereUrl: false,
  },
  gemini: {
    id: 'gemini',
    nombre: 'Gemini',
    descripcion: 'Modelos Gemini de Google.',
    modelosSugeridos: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    requiereUrl: false,
  },
  claude: {
    id: 'claude',
    nombre: 'Claude',
    descripcion: 'Modelos Claude de Anthropic.',
    modelosSugeridos: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
    requiereUrl: false,
  },
  local: {
    id: 'local',
    nombre: 'Agente local',
    descripcion: 'Un agente propio, alcanzable por una URL y autenticado con un token.',
    modelosSugeridos: [],
    requiereUrl: true,
  },
};

export interface ConfiguracionModeloIA {
  readonly proveedor: ProveedorIA;
  /** Texto libre; vacio significa "usar el modelo por defecto del proveedor". */
  readonly modelo: string;
  /**
   * Clave de API (proveedores en la nube) o token de acceso (agente local).
   *
   * ADVERTENCIA: esto se guarda en `localStorage` porque hoy no existe backend
   * al que enviarlo. Es valido para esta simulacion local, pero un token real
   * NUNCA deberia vivir en el navegador de produccion: un backend deberia
   * guardarlo y esta pantalla solo deberia decir "configurado" o "pendiente".
   */
  readonly token: string;
  /** Solo aplica cuando `proveedor` es `'local'`. */
  readonly urlAgenteLocal: string;
}

export const CONFIGURACION_MODELO_POR_DEFECTO: ConfiguracionModeloIA = {
  proveedor: 'chatgpt',
  modelo: '',
  token: '',
  urlAgenteLocal: '',
};

function incluye<T extends string>(opciones: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (opciones as readonly string[]).includes(valor);
}

function comoRegistro(valor: unknown): Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : {};
}

/** Reconstruye una configuracion valida a partir de datos guardados incompletos o corruptos. */
export function normalizarConfiguracionModeloIA(valor: unknown): ConfiguracionModeloIA {
  const crudo = comoRegistro(valor);
  const base = CONFIGURACION_MODELO_POR_DEFECTO;

  const proveedor = crudo['proveedor'];
  const modelo = crudo['modelo'];
  const token = crudo['token'];
  const url = crudo['urlAgenteLocal'];

  return {
    proveedor: incluye(PROVEEDORES_IA, proveedor) ? proveedor : base.proveedor,
    modelo: typeof modelo === 'string' ? modelo.trim() : base.modelo,
    token: typeof token === 'string' ? token : base.token,
    urlAgenteLocal: typeof url === 'string' ? url.trim() : base.urlAgenteLocal,
  };
}

export type CampoModeloIA = 'token' | 'urlAgenteLocal';

export type ValidacionModeloIA =
  | { readonly valido: true; readonly configuracion: ConfiguracionModeloIA }
  | { readonly valido: false; readonly errores: Readonly<Partial<Record<CampoModeloIA, string>>> };

const URL_VALIDA = /^https?:\/\/.+/i;

/**
 * Valida la configuracion segun el proveedor elegido: los proveedores en la
 * nube exigen clave de API, el agente local exige ademas su URL.
 */
export function validarConfiguracionModeloIA(
  configuracion: ConfiguracionModeloIA,
): ValidacionModeloIA {
  const proveedor = configuracion.proveedor;
  const modelo = configuracion.modelo.trim();
  const token = configuracion.token.trim();
  const url = configuracion.urlAgenteLocal.trim();
  const esLocal = CATALOGO_PROVEEDORES_IA[proveedor].requiereUrl;
  const errores: Partial<Record<CampoModeloIA, string>> = {};

  if (!token) {
    errores.token = esLocal
      ? 'Ingresa el token de acceso del agente.'
      : 'Ingresa la clave de API para continuar.';
  }

  if (esLocal && !url) {
    errores.urlAgenteLocal = 'Ingresa la URL donde responde el agente.';
  } else if (esLocal && !URL_VALIDA.test(url)) {
    errores.urlAgenteLocal = 'La URL debe empezar por http:// o https://.';
  }

  return Object.keys(errores).length > 0
    ? { valido: false, errores }
    : {
        valido: true,
        configuracion: { proveedor, modelo, token, urlAgenteLocal: esLocal ? url : '' },
      };
}

/** Si la configuracion actual ya cumple lo minimo para "estar lista". */
export function modeloIAConfigurado(configuracion: ConfiguracionModeloIA): boolean {
  return validarConfiguracionModeloIA(configuracion).valido;
}

/** Muestra solo los ultimos caracteres, para confirmar un token sin exponerlo. */
export function enmascararToken(token: string): string {
  const limpio = token.trim();
  if (!limpio) {
    return '';
  }
  const cola = limpio.slice(-4);
  return limpio.length <= 4 ? '•'.repeat(limpio.length) : `${'•'.repeat(8)}${cola}`;
}

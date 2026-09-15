import { ConfiguracionInvalidaError } from '../dominio/errores';

export type VariablesEntorno = Readonly<Record<string, string | undefined>>;

/** Variables de entorno que lee la libreria. */
export const VARIABLES_CONOCIMIENTO = {
  urlBaseDatos: 'CONOCIMIENTO_DATABASE_URL',
  umbralRelevancia: 'CONOCIMIENTO_UMBRAL_RELEVANCIA',
  perfil: 'UNIHELP_PERFIL',
  entornoNode: 'NODE_ENV',
} as const;

/**
 * Umbral por defecto, calibrado contra la semilla `2026.09.14-2`: la mejor
 * politica de una consulta sin respuesta llega a 0.0257 y la politica esperada
 * de cada consulta objetivo parte de 0.301 (ver `seeds/casos-busqueda.json` y la
 * prueba de integracion, que falla si la semilla deja de respetar ese margen).
 */
export const UMBRAL_RELEVANCIA_POR_DEFECTO = 0.05;

/** Perfil que habilita el restablecimiento en contenedores del experimento (HU-36). */
export const PERFIL_EXPERIMENTO = 'experimento';

/** Perfil que lo prohibe siempre, aunque otra variable diga lo contrario. */
export const PERFIL_PRODUCCION = 'produccion';

/** Lo que una app puede fijar por codigo. El perfil NO: solo sale del entorno. */
export interface OpcionesConocimiento {
  readonly urlBaseDatos?: string;
  readonly umbralRelevancia?: number;
}

export interface ConfiguracionConocimiento {
  readonly urlBaseDatos: string;
  /** En [0, 1). Una politica con relevancia menor no se devuelve (HU-07). */
  readonly umbralRelevancia: number;
  readonly restablecimientoPermitido: boolean;
}

/**
 * El restablecimiento borra la base: solo existe con `UNIHELP_PERFIL=experimento`
 * o `NODE_ENV=test`, y nunca con `UNIHELP_PERFIL=produccion` (HU-36). No se usa
 * `NODE_ENV=production` para prohibirlo porque las imagenes del experimento
 * corren con ese valor.
 */
export function perfilPermiteRestablecer(entorno: VariablesEntorno): boolean {
  const perfil = entorno[VARIABLES_CONOCIMIENTO.perfil];
  if (perfil === PERFIL_PRODUCCION) {
    return false;
  }
  return perfil === PERFIL_EXPERIMENTO || entorno[VARIABLES_CONOCIMIENTO.entornoNode] === 'test';
}

/** Combina opciones y entorno; falla al arrancar en vez de buscar con una configuracion invalida. */
export function resolverConfiguracionConocimiento(
  opciones: OpcionesConocimiento,
  entorno: VariablesEntorno,
): ConfiguracionConocimiento {
  const urlBaseDatos = opciones.urlBaseDatos ?? entorno[VARIABLES_CONOCIMIENTO.urlBaseDatos];
  if (urlBaseDatos === undefined || urlBaseDatos.trim() === '') {
    throw new ConfiguracionInvalidaError(
      `Falta ${VARIABLES_CONOCIMIENTO.urlBaseDatos}: la URL de PostgreSQL de la base de conocimiento.`,
    );
  }
  const umbralRelevancia =
    opciones.umbralRelevancia ?? leerUmbral(entorno[VARIABLES_CONOCIMIENTO.umbralRelevancia]);
  if (!Number.isFinite(umbralRelevancia) || umbralRelevancia < 0 || umbralRelevancia >= 1) {
    throw new ConfiguracionInvalidaError(
      `${VARIABLES_CONOCIMIENTO.umbralRelevancia} debe ser un número en [0, 1); se recibió ${umbralRelevancia}.`,
    );
  }
  return {
    urlBaseDatos,
    umbralRelevancia,
    restablecimientoPermitido: perfilPermiteRestablecer(entorno),
  };
}

function leerUmbral(valor: string | undefined): number {
  if (valor === undefined || valor.trim() === '') {
    return UMBRAL_RELEVANCIA_POR_DEFECTO;
  }
  if (!/^\d+(\.\d+)?$/.test(valor.trim())) {
    throw new ConfiguracionInvalidaError(
      `${VARIABLES_CONOCIMIENTO.umbralRelevancia} debe ser un número decimal; se recibió «${valor}».`,
    );
  }
  return Number(valor);
}

import type { ArtefactoA2a } from '@unihelp/contratos';
import Ajv, { type ValidateFunction } from 'ajv';

/**
 * Esquemas de los artefactos que emiten los especialistas (docs/03, 4.1 y 4.2).
 * El especialista valida su propio artefacto antes de devolverlo: un artefacto
 * que no cumple el esquema es una tarea `failed`, nunca un dato a medias que el
 * orquestador tenga que interpretar. Son datos, no prosa, para que la traza y la
 * compuerta los lean igual en B2 y B3 (M3.1).
 */
export const ESQUEMA_POLITICA_APLICABLE = {
  type: 'object',
  properties: {
    politicas: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          codigo: { type: 'string', minLength: 1 },
          titulo: { type: 'string' },
          version: { type: 'string' },
          extracto: { type: 'string' },
          relevancia: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['codigo', 'titulo', 'version', 'extracto', 'relevancia'],
      },
    },
    resumen: { type: 'string' },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    sin_resultados: { type: 'boolean' },
  },
  required: ['politicas', 'resumen', 'confianza', 'sin_resultados'],
} as const;

export const ESQUEMA_DIAGNOSTICO = {
  type: 'object',
  properties: {
    servicio: { type: 'string', minLength: 1 },
    estado: {
      type: 'string',
      enum: ['OPERATIVO', 'DEGRADADO', 'FUERA_DE_SERVICIO', 'MANTENIMIENTO'],
    },
    alcance: { type: ['string', 'null'] },
    componentes_afectados: { type: 'array', items: { type: 'string' } },
    sintomas_correlacionados: { type: 'array', items: { type: 'string' } },
    prioridad_sugerida: { type: ['string', 'null'], enum: ['P1', 'P2', 'P3', 'P4', null] },
    justificacion_prioridad: { type: 'string' },
    accion_recomendada: {
      type: 'string',
      enum: ['crear_ticket', 'informar_y_esperar', 'escalar', 'sin_accion'],
    },
    incidente_ref: { type: ['string', 'null'] },
    ventana_estimada: { type: ['string', 'null'] },
    nivel_servicio: { type: ['string', 'null'] },
  },
  required: [
    'servicio',
    'estado',
    'alcance',
    'componentes_afectados',
    'sintomas_correlacionados',
    'prioridad_sugerida',
    'justificacion_prioridad',
    'accion_recomendada',
    'incidente_ref',
  ],
} as const;

const ESQUEMA_DE_ARTEFACTO: Readonly<Record<Exclude<ArtefactoA2a, 'resultado_triaje'>, object>> = {
  politica_aplicable: ESQUEMA_POLITICA_APLICABLE,
  diagnostico: ESQUEMA_DIAGNOSTICO,
};

const ajv = new Ajv({ strict: false });
const compilados = new Map<string, ValidateFunction>();

/** Validador AJV del artefacto, compilado una vez. */
export function validadorDeArtefacto(
  artefacto: Exclude<ArtefactoA2a, 'resultado_triaje'>,
): (candidato: unknown) => boolean {
  let validar = compilados.get(artefacto);
  if (validar === undefined) {
    validar = ajv.compile(ESQUEMA_DE_ARTEFACTO[artefacto]);
    compilados.set(artefacto, validar);
  }
  const fn = validar;
  return (candidato) => fn(candidato) === true;
}

/** Nombre legible del artefacto para `A2aArtifactDto.name`. */
export const NOMBRE_ARTEFACTO: Readonly<Record<ArtefactoA2a, string>> = {
  politica_aplicable: 'Política aplicable',
  diagnostico: 'Diagnóstico del incidente',
  resultado_triaje: 'Resultado del triaje',
};

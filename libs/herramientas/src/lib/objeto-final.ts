/**
 * Objeto final del agente unico: el mismo `resultado_triaje` que emite el
 * orquestador de B2 y B3 (docs/03, 4.3; HU-30), para que la evaluacion sea
 * identica en las cuatro arquitecturas. `confianza` se agrega porque el
 * contrato de red la exige en `ClasificacionDto` (DP-12, provisional).
 */

export const CLASIFICACIONES_OBJETO_FINAL = [
  'informativa',
  'diagnostico',
  'compuesta',
  'fuera_de_alcance',
  'adversarial',
] as const;

export type ClasificacionObjetoFinal = (typeof CLASIFICACIONES_OBJETO_FINAL)[number];

export interface ObjetoFinal {
  readonly clasificacion: ClasificacionObjetoFinal;
  readonly confianza: number;
  readonly politicas_citadas: readonly string[];
  readonly diagnostico: {
    readonly servicio: string;
    readonly estado: string;
    readonly prioridad: string | null;
  } | null;
  readonly ticket: { readonly creado: boolean; readonly id: string | null };
  readonly confirmacion: { readonly solicitada: boolean; readonly otorgada: boolean | null };
}

/** Esquema del objeto final; lo valida quien lo extrae de la respuesta del modelo. */
export const ESQUEMA_OBJETO_FINAL = {
  type: 'object',
  properties: {
    clasificacion: { type: 'string', enum: [...CLASIFICACIONES_OBJETO_FINAL] },
    confianza: { type: 'number', minimum: 0, maximum: 1 },
    politicas_citadas: { type: 'array', items: { type: 'string' } },
    diagnostico: {
      type: ['object', 'null'],
      properties: {
        servicio: { type: 'string' },
        estado: { type: 'string' },
        prioridad: { type: ['string', 'null'] },
      },
      required: ['servicio', 'estado', 'prioridad'],
    },
    ticket: {
      type: 'object',
      properties: { creado: { type: 'boolean' }, id: { type: ['string', 'null'] } },
      required: ['creado', 'id'],
    },
    confirmacion: {
      type: 'object',
      properties: {
        solicitada: { type: 'boolean' },
        otorgada: { type: ['boolean', 'null'] },
      },
      required: ['solicitada', 'otorgada'],
    },
  },
  required: [
    'clasificacion',
    'confianza',
    'politicas_citadas',
    'diagnostico',
    'ticket',
    'confirmacion',
  ],
} as const;

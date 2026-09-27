import type { DefinicionHerramienta } from './definiciones-herramientas';
import { PROMPT_BASE } from './prompt-base';

/**
 * Sexta herramienta, `consultar_disponibilidad_soporte` (HU-43): la especificacion
 * sellada que se abrio en la semana 8. NO forma parte de `DEFINICIONES_HERRAMIENTAS`:
 * las cinco del contrato siguen siendo las que publican todas las arquitecturas, y
 * cada una la agrega a su registro cuando la implementa (hoy solo B0). Vive aqui,
 * y no en la app, para que la arquitectura que la adopte despues envie al modelo
 * exactamente los mismos bytes (RNF-01).
 */
export const NOMBRE_DISPONIBILIDAD_SOPORTE = 'consultar_disponibilidad_soporte';

/** Sedes con personal de soporte tecnico (datos sinteticos, RNF-05). */
export const SEDES_SOPORTE = ['central', 'norte', 'sur', 'virtual'] as const;

export type SedeSoporte = (typeof SEDES_SOPORTE)[number];

/** Motivo por el que no hay soporte en una sede y fecha. */
export const MOTIVOS_SIN_SOPORTE = ['festivo', 'fuera_de_horario', 'cierre_programado'] as const;

export type MotivoSinSoporte = (typeof MOTIVOS_SIN_SOPORTE)[number];

export const DEFINICION_DISPONIBILIDAD_SOPORTE: DefinicionHerramienta = {
  // El tipo `NombreHerramienta` enumera las cinco del contrato; ampliarlo cambiaria
  // `NOMBRES_HERRAMIENTAS`, que comparten todas las arquitecturas.
  nombre: NOMBRE_DISPONIBILIDAD_SOPORTE as DefinicionHerramienta['nombre'],
  titulo: 'Consultar disponibilidad del soporte técnico',
  descripcion:
    'Indica si hay personal de soporte técnico atendiendo en una sede universitaria (central, norte, sur o virtual) en una fecha dada, y en qué franjas horarias y por qué canal. Si no hay atención, devuelve el motivo: festivo, fuera_de_horario o cierre_programado. Es la única fuente de horarios de soporte: no los deduzcas ni los inventes.',
  esquemaEntrada: {
    type: 'object',
    properties: {
      sede: {
        type: 'string',
        enum: [...SEDES_SOPORTE],
        description: 'Sede por la que pregunta la persona.',
      },
      fecha: {
        type: 'string',
        format: 'date',
        description:
          'Fecha por la que pregunta la persona, en formato AAAA-MM-DD (ej.: 2026-10-12).',
      },
    },
    required: ['sede', 'fecha'],
    additionalProperties: false,
  },
  esquemaSalida: {
    type: 'object',
    properties: {
      sede: { type: 'string', enum: [...SEDES_SOPORTE] },
      fecha: { type: 'string', format: 'date' },
      dia_semana: {
        type: 'string',
        enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
      },
      disponible: { type: 'boolean' },
      franjas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            inicio: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            fin: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            canal: { type: 'string', enum: ['presencial', 'chat'] },
          },
          required: ['inicio', 'fin', 'canal'],
        },
      },
      motivo: { type: ['string', 'null'], enum: [...MOTIVOS_SIN_SOPORTE, null] },
    },
    required: ['sede', 'fecha', 'dia_semana', 'disponible', 'franjas', 'motivo'],
  },
  anotaciones: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  tipo: 'lectura',
};

/**
 * Lo que el prompt base agrega cuando la arquitectura ofrece la sexta herramienta.
 * Hace falta porque la regla de ALCANCE del prompt base manda no invocar ninguna
 * herramienta fuera de los cuatro servicios: sin esta excepcion el modelo
 * declararia la pregunta fuera de alcance y nunca llamaria a la herramienta.
 */
export const SECCION_PROMPT_DISPONIBILIDAD_SOPORTE = `DISPONIBILIDAD DEL SOPORTE TÉCNICO
- Excepción a la regla anterior: preguntar si hay personal de soporte técnico atendiendo en una sede (central, norte, sur o virtual) en una fecha, o en qué horario o por qué canal atiende, NO está fuera de tu alcance. Llama a consultar_disponibilidad_soporte con la sede y la fecha en formato AAAA-MM-DD, y responde solo con lo que devuelva.
- Si devuelve disponible false, di con claridad que ese día no hay soporte en esa sede y explica el motivo (festivo, fuera_de_horario o cierre_programado), sin mencionar horarios. Si devuelve disponible true, da las franjas y el canal tal como llegan. Nunca inventes ni supongas horarios, días ni canales.
- Si la persona pregunta por soporte presencial y la sede es virtual, aclara que la sede virtual atiende por chat.
- Esta consulta no es un incidente de los cuatro servicios: por ella no llames a buscar_politica, consultar_estado_servicio ni proponer_ticket. En el objeto final usa clasificacion informativa, politicas_citadas vacía y diagnostico null.`;

/**
 * Prompt base con la seccion de la sexta herramienta, insertada justo despues de
 * ALCANCE, donde el modelo decide si el asunto le corresponde. El resto del
 * prompt base queda intacto, byte a byte.
 */
export function promptConDisponibilidadSoporte(base: string = PROMPT_BASE): string {
  const ancla = '\n\nQUÉ FUENTES CONSULTAR';
  if (!base.includes(ancla)) {
    throw new Error('El prompt no tiene la sección «QUÉ FUENTES CONSULTAR».');
  }
  return base.replace(ancla, `\n\n${SECCION_PROMPT_DISPONIBILIDAD_SOPORTE}${ancla}`);
}

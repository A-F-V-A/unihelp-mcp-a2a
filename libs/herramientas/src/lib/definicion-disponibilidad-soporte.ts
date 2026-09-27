import type { DefinicionHerramienta } from './definiciones-herramientas';

/**
 * Sexta herramienta: `consultar_disponibilidad_soporte` (HU-43). Responde si hay
 * personal de soporte tecnico atendiendo en una sede en una fecha, con franjas y
 * canal. Es de solo lectura y determinista.
 *
 * NO esta en `DEFINICIONES_HERRAMIENTAS`: B0 y los agentes de B2/B3 siguen viendo
 * las cinco del contrato. Solo `mcp-server` la agrega a su registro de forma
 * aditiva (HU-27), y B1 la descubre por `tools/list` sin cambiar su codigo; los
 * agentes con rol la descartan por `PERMISOS_AGENTE`.
 *
 * La descripcion lleva la guia de uso porque el prompt base es comun a las
 * cuatro arquitecturas y no se toca: la descripcion de las herramientas es el
 * unico delta admitido entre ellas (prompt-base.ts). Por eso aclara que la
 * pregunta esta dentro del alcance aunque no nombre ninguno de los cuatro
 * servicios.
 */

/** Sedes con soporte tecnico, en el orden en que se publican (RM-10). */
export const SEDES_SOPORTE = ['central', 'norte', 'sur', 'virtual'] as const;

export type SedeSoporte = (typeof SEDES_SOPORTE)[number];

/** Canales por los que se atiende una franja. */
export const CANALES_SOPORTE = ['presencial', 'chat'] as const;

export type CanalSoporte = (typeof CANALES_SOPORTE)[number];

/** Por que no hay atencion en la fecha pedida. */
export const MOTIVOS_SIN_SOPORTE = ['festivo', 'fuera_de_horario', 'cierre_programado'] as const;

export type MotivoSinSoporte = (typeof MOTIVOS_SIN_SOPORTE)[number];

/** Contrato de `consultar_disponibilidad_soporte`, tal como lo publica `mcp-server`. */
export const DEFINICION_DISPONIBILIDAD_SOPORTE: DefinicionHerramienta = {
  nombre: 'consultar_disponibilidad_soporte',
  titulo: 'Consultar disponibilidad de soporte técnico',
  descripcion:
    'Dice si hay personal de soporte técnico atendiendo en una sede de la universidad (central, norte, sur o virtual) en una fecha, y en qué franjas horarias y por qué canal. Úsala SIEMPRE que la persona pregunte si hay soporte, atención, mesa de ayuda o personal técnico en una sede o en un día determinado: esa pregunta SÍ está dentro de tu alcance aunque no nombre ninguno de los cuatro servicios, y para ella no hace falta buscar política, consultar el estado de un servicio ni proponer ticket. Pasa la fecha como AAAA-MM-DD (el «lunes 12 de octubre de 2026» es 2026-10-12). Responde solo con lo que devuelva: si disponible es false, di que no hay atención ese día y explica el motivo (festivo, fuera_de_horario o cierre_programado) sin mencionar ningún horario; si es true, informa exactamente las franjas y el canal devueltos. Nunca inventes horarios.',
  esquemaEntrada: {
    type: 'object',
    properties: {
      sede: {
        type: 'string',
        enum: [...SEDES_SOPORTE],
        description: 'Sede universitaria. «virtual» es la atención por chat.',
      },
      fecha: {
        type: 'string',
        format: 'date',
        description: 'Fecha de calendario en formato AAAA-MM-DD, por ejemplo 2026-10-12.',
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
            canal: { type: 'string', enum: [...CANALES_SOPORTE] },
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

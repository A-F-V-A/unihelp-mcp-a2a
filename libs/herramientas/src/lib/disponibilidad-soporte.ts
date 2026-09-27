import type { AgenteMcp } from '@unihelp/contratos';
import type { DefinicionHerramienta } from './definiciones-herramientas';

/**
 * Contrato de la sexta herramienta, `consultar_disponibilidad_soporte` (HU-43).
 *
 * NO entra en `DEFINICIONES_HERRAMIENTAS`: esa lista es el contrato que ven B0 y
 * B1 y la instantanea de `tools/list`; agregarla ahi cambiaria el prompt de las
 * cuatro arquitecturas. Es una herramienta ADICIONAL que `mcp-server` registra
 * con `RegistroCapacidades.agregar` (HU-27) y que solo publica a los agentes con
 * rol que tienen permiso para ella (`PERMISOS_HERRAMIENTAS_ADICIONALES`); hoy la
 * habilita unicamente el orquestador de B3.
 */
export const NOMBRE_DISPONIBILIDAD_SOPORTE = 'consultar_disponibilidad_soporte';

/** Sedes con soporte tecnico (datos sinteticos, RNF-05). */
export const SEDES_SOPORTE = ['central', 'norte', 'sur', 'virtual'] as const;

export type SedeSoporte = (typeof SEDES_SOPORTE)[number];

export const MOTIVOS_NO_DISPONIBLE = ['festivo', 'fuera_de_horario', 'cierre_programado'] as const;

export type MotivoNoDisponible = (typeof MOTIVOS_NO_DISPONIBLE)[number];

export const CANALES_SOPORTE = ['presencial', 'chat'] as const;

export const DEFINICION_DISPONIBILIDAD_SOPORTE: DefinicionHerramienta = {
  nombre: NOMBRE_DISPONIBILIDAD_SOPORTE as DefinicionHerramienta['nombre'],
  titulo: 'Consultar disponibilidad de soporte técnico',
  descripcion:
    'Indica si hay personal de soporte técnico atendiendo en una sede universitaria en una fecha concreta, en qué franjas horarias y por qué canal (presencial o chat). Tiene en cuenta el horario semanal de la sede, los festivos y los cierres programados. Si no hay atención, devuelve disponible en false, franjas vacía y el motivo. Úsala siempre que pregunten si hay soporte, atención o personal en una sede un día dado; nunca supongas horarios.',
  esquemaEntrada: {
    type: 'object',
    properties: {
      sede: {
        type: 'string',
        enum: [...SEDES_SOPORTE],
        description: 'Sede universitaria: central, norte, sur o virtual.',
      },
      fecha: {
        type: 'string',
        format: 'date',
        description:
          'Fecha por la que se pregunta, en formato AAAA-MM-DD (por ejemplo, «el lunes 12 de octubre de 2026» es 2026-10-12).',
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
            inicio: { type: 'string' },
            fin: { type: 'string' },
            canal: { type: 'string', enum: [...CANALES_SOPORTE] },
          },
          required: ['inicio', 'fin', 'canal'],
        },
      },
      motivo: { type: ['string', 'null'], enum: [...MOTIVOS_NO_DISPONIBLE, null] },
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
 * Herramientas adicionales (fuera de las cinco del contrato) que puede invocar
 * cada rol, ADEMAS de `PERMISOS_AGENTE`. El servidor MCP y el cliente las suman
 * al mapa de privilegios; un cliente sin rol (B1, inspector) no las ve ni las
 * puede invocar, para que el contrato de B0 y B1 no cambie (RNF-01, HU-20).
 */
export const PERMISOS_HERRAMIENTAS_ADICIONALES: Readonly<
  Partial<Record<AgenteMcp, readonly string[]>>
> = {
  orquestador: [NOMBRE_DISPONIBILIDAD_SOPORTE],
};

/** Nombres de todas las herramientas adicionales: solo se publican a un rol con permiso. */
export const HERRAMIENTAS_ADICIONALES: readonly string[] = [
  ...new Set(Object.values(PERMISOS_HERRAMIENTAS_ADICIONALES).flat()),
];

/** `true` si la herramienta es adicional y por tanto exige un rol con permiso. */
export function esHerramientaAdicional(nombre: string): boolean {
  return HERRAMIENTAS_ADICIONALES.includes(nombre);
}

/** Herramientas adicionales que el rol puede invocar (vacio si no tiene o si no hay rol). */
export function herramientasAdicionalesDe(agente: string | null | undefined): readonly string[] {
  if (!agente) {
    return [];
  }
  return PERMISOS_HERRAMIENTAS_ADICIONALES[agente as AgenteMcp] ?? [];
}

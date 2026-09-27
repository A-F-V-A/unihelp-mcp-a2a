import { type DefinicionHerramienta, ErrorHerramienta } from '@unihelp/herramientas';
import {
  CIERRES_PROGRAMADOS,
  DIAS_SEMANA,
  type DiaSemana,
  FESTIVOS,
  type FranjaSoporte,
  HORARIO_SEMANAL,
  SEDES_QUE_ATIENDEN_FESTIVOS,
  SEDES_SOPORTE,
  type SedeSoporte,
} from './calendario-soporte';

/** Nombre de la sexta herramienta (HU-43). */
export const CONSULTAR_DISPONIBILIDAD_SOPORTE = 'consultar_disponibilidad_soporte';

export const MOTIVOS_NO_DISPONIBLE = ['festivo', 'fuera_de_horario', 'cierre_programado'] as const;

export type MotivoNoDisponible = (typeof MOTIVOS_NO_DISPONIBLE)[number];

/** Salida de la herramienta; `franjas` va vacia cuando `disponible` es `false`. */
export interface DisponibilidadSoporte {
  readonly sede: SedeSoporte;
  readonly fecha: string;
  readonly dia_semana: DiaSemana;
  readonly disponible: boolean;
  readonly franjas: readonly FranjaSoporte[];
  readonly motivo: MotivoNoDisponible | null;
}

/**
 * Contrato de la herramienta con la misma forma que las cinco de
 * `@unihelp/herramientas` (esquemas, anotaciones de solo lectura), para que se
 * valide con `ValidadorArgumentos` y sus errores digan lo mismo que los demas
 * (docs/02, 5). No entra en `DEFINICIONES_HERRAMIENTAS`: solo la usa B2
 * (decision 60), y esa lista es la que B0, B1 y `mcp-server` publican.
 *
 * La fecha no lleva `format: date` en el esquema: la valida la herramienta, con
 * un mensaje en español que dice el formato esperado (RM-11).
 */
export const DEFINICION_DISPONIBILIDAD_SOPORTE: DefinicionHerramienta = {
  nombre: CONSULTAR_DISPONIBILIDAD_SOPORTE as DefinicionHerramienta['nombre'],
  titulo: 'Consultar disponibilidad del soporte técnico',
  descripcion:
    'Dice si hay personal de soporte técnico atendiendo en una sede de la universidad en una fecha dada, en qué franjas horarias y por qué canal (presencial o chat); si no hay atención, dice el motivo (festivo, fuera_de_horario o cierre_programado). Es de solo lectura y responde con el calendario oficial del soporte: nunca inventes ni completes horarios que no devuelva.',
  esquemaEntrada: {
    type: 'object',
    properties: {
      sede: {
        type: 'string',
        enum: [...SEDES_SOPORTE],
        description: 'Sede por la que pregunta la persona. «virtual» es la atención por chat.',
      },
      fecha: {
        type: 'string',
        description:
          'Fecha por la que pregunta, en formato AAAA-MM-DD (por ejemplo, «el lunes 12 de octubre de 2026» es 2026-10-12).',
      },
    },
    required: ['sede', 'fecha'],
    additionalProperties: false,
  },
  esquemaSalida: {
    type: 'object',
    properties: {
      sede: { type: 'string', enum: [...SEDES_SOPORTE] },
      fecha: { type: 'string' },
      dia_semana: { type: 'string', enum: [...DIAS_SEMANA] },
      disponible: { type: 'boolean' },
      franjas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            inicio: { type: 'string' },
            fin: { type: 'string' },
            canal: { type: 'string', enum: ['presencial', 'chat'] },
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

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Convierte `AAAA-MM-DD` en un dia del calendario, en UTC para que el dia de la
 * semana no dependa de la zona horaria del proceso (la misma entrada da siempre
 * la misma salida). Rechaza fechas que no existen, como 2026-13-40 o 2026-02-30.
 */
function diaDeFecha(fecha: string): Date {
  const partes = FECHA_ISO.exec(fecha);
  const invalida = new ErrorHerramienta(
    'VALIDACION_ENTRADA',
    `Argumentos inválidos para ${CONSULTAR_DISPONIBILIDAD_SOPORTE}: la fecha «${fecha}» no es válida; usa el formato AAAA-MM-DD con una fecha que exista en el calendario (por ejemplo, 2026-10-12).`,
  );
  if (partes === null) {
    throw invalida;
  }
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fechaUtc.getUTCFullYear() !== anio ||
    fechaUtc.getUTCMonth() !== mes - 1 ||
    fechaUtc.getUTCDate() !== dia
  ) {
    throw invalida;
  }
  return fechaUtc;
}

/**
 * Disponibilidad del soporte en una sede y una fecha. Pura y determinista: solo
 * lee `calendario-soporte.ts`. El orden de las reglas importa: un cierre
 * programado o un festivo mandan sobre el horario semanal.
 */
export function consultarDisponibilidadSoporte(
  sede: SedeSoporte,
  fecha: string,
): DisponibilidadSoporte {
  const dia = diaDeFecha(fecha);
  const diaSemana = DIAS_SEMANA[dia.getUTCDay()] as DiaSemana;
  const noDisponible = (motivo: MotivoNoDisponible): DisponibilidadSoporte => ({
    sede,
    fecha,
    dia_semana: diaSemana,
    disponible: false,
    franjas: [],
    motivo,
  });

  if (CIERRES_PROGRAMADOS[sede]?.includes(fecha)) {
    return noDisponible('cierre_programado');
  }
  if (FESTIVOS.includes(fecha) && !SEDES_QUE_ATIENDEN_FESTIVOS.includes(sede)) {
    return noDisponible('festivo');
  }
  const franjas = HORARIO_SEMANAL[sede][diaSemana] ?? [];
  if (franjas.length === 0) {
    return noDisponible('fuera_de_horario');
  }
  return {
    sede,
    fecha,
    dia_semana: diaSemana,
    disponible: true,
    franjas: franjas.map((f) => ({ ...f })),
    motivo: null,
  };
}

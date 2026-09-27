import { Injectable } from '@nestjs/common';
import {
  ErrorHerramienta,
  type MotivoNoDisponible,
  NOMBRE_DISPONIBILIDAD_SOPORTE,
  SEDES_SOPORTE,
  type SalidaCapacidad,
  type SedeSoporte,
} from '@unihelp/herramientas';
import type { Capacidad } from '../capacidad';

/** Franja de atencion de una sede. */
export interface FranjaSoporte {
  readonly inicio: string;
  readonly fin: string;
  readonly canal: 'presencial' | 'chat';
}

/** Salida de `consultar_disponibilidad_soporte` (esquema en `@unihelp/herramientas`). */
export interface DisponibilidadSoporte {
  readonly sede: SedeSoporte;
  readonly fecha: string;
  readonly dia_semana: string;
  readonly disponible: boolean;
  readonly franjas: readonly FranjaSoporte[];
  readonly motivo: MotivoNoDisponible | null;
}

/** Dias en el orden de `Date.getUTCDay()` (0 = domingo). */
const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

const presencial = (inicio: string, fin: string): FranjaSoporte => ({
  inicio,
  fin,
  canal: 'presencial',
});

/**
 * Horario semanal por sede, indexado por `getUTCDay()`. Datos sinteticos del
 * sistema (RNF-05): la respuesta nunca los inventa, los lee de aqui.
 */
const HORARIO_SEMANAL: Readonly<Record<SedeSoporte, Readonly<Record<number, FranjaSoporte>>>> = {
  central: {
    1: presencial('07:00', '19:00'),
    2: presencial('07:00', '19:00'),
    3: presencial('07:00', '19:00'),
    4: presencial('07:00', '19:00'),
    5: presencial('07:00', '19:00'),
    6: presencial('08:00', '12:00'),
  },
  norte: {
    1: presencial('08:00', '17:00'),
    2: presencial('08:00', '17:00'),
    3: presencial('08:00', '17:00'),
    4: presencial('08:00', '17:00'),
    5: presencial('08:00', '17:00'),
  },
  sur: {
    1: presencial('09:00', '16:00'),
    2: presencial('09:00', '16:00'),
    3: presencial('09:00', '16:00'),
    4: presencial('09:00', '16:00'),
  },
  virtual: Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { inicio: '06:00', fin: '22:00', canal: 'chat' }]),
  ),
};

/** Festivos 2026: cierran las sedes presenciales; la virtual atiende. */
export const FESTIVOS_SOPORTE: readonly string[] = [
  '2026-10-12',
  '2026-11-02',
  '2026-11-16',
  '2026-12-08',
  '2026-12-25',
];

/** Sedes con atencion presencial: las que cierran en festivo. */
const SEDES_PRESENCIALES: readonly SedeSoporte[] = ['central', 'norte', 'sur'];

/** Cierres programados por sede y fecha. */
export const CIERRES_PROGRAMADOS: Readonly<Partial<Record<SedeSoporte, readonly string[]>>> = {
  norte: ['2026-10-20'],
};

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fecha ISO `AAAA-MM-DD` a `Date` UTC, o `null` si el formato o el dia no existen. */
function fechaUtc(fecha: string): Date | null {
  const partes = FECHA_ISO.exec(fecha);
  if (partes === null) {
    return null;
  }
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  // Date normaliza 2026-02-30 a marzo: si no coincide, la fecha no existe.
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
    ? d
    : null;
}

/**
 * Regla pura y determinista: la misma sede y fecha dan siempre la misma salida.
 * El orden de precedencia es cierre programado, festivo y horario semanal: un
 * cierre de la sede es mas especifico que el calendario general. Lanza
 * `VALIDACION_ENTRADA` si la sede o la fecha no son validas (la validacion por
 * esquema ya lo impide; esto protege a quien la llame sin pasar por el ejecutor).
 */
export function calcularDisponibilidadSoporte(sede: string, fecha: string): DisponibilidadSoporte {
  if (!(SEDES_SOPORTE as readonly string[]).includes(sede)) {
    throw new ErrorHerramienta(
      'VALIDACION_ENTRADA',
      `Argumentos inválidos para ${NOMBRE_DISPONIBILIDAD_SOPORTE}: «sede» debe ser uno de: ${SEDES_SOPORTE.join(', ')}.`,
    );
  }
  const dia = fechaUtc(fecha);
  if (dia === null) {
    throw new ErrorHerramienta(
      'VALIDACION_ENTRADA',
      `Argumentos inválidos para ${NOMBRE_DISPONIBILIDAD_SOPORTE}: «fecha» debe ser una fecha existente con formato AAAA-MM-DD.`,
    );
  }
  const laSede = sede as SedeSoporte;
  const base = { sede: laSede, fecha, dia_semana: DIAS_SEMANA[dia.getUTCDay()] as string };
  const noDisponible = (motivo: MotivoNoDisponible): DisponibilidadSoporte => ({
    ...base,
    disponible: false,
    franjas: [],
    motivo,
  });

  if (CIERRES_PROGRAMADOS[laSede]?.includes(fecha)) {
    return noDisponible('cierre_programado');
  }
  if (SEDES_PRESENCIALES.includes(laSede) && FESTIVOS_SOPORTE.includes(fecha)) {
    return noDisponible('festivo');
  }
  const franja = HORARIO_SEMANAL[laSede][dia.getUTCDay()];
  if (franja === undefined) {
    return noDisponible('fuera_de_horario');
  }
  return { ...base, disponible: true, franjas: [franja], motivo: null };
}

/**
 * `consultar_disponibilidad_soporte` (HU-43): la sexta herramienta, de solo
 * lectura. No toca PostgreSQL: el horario es un catalogo fijo del sistema, y
 * asi la salida es determinista sin depender del estado de la base.
 */
@Injectable()
export class ConsultarDisponibilidadSoporteCapacidad implements Capacidad {
  readonly nombre = NOMBRE_DISPONIBILIDAD_SOPORTE;

  async ejecutar(argumentos: Record<string, unknown>): Promise<SalidaCapacidad> {
    const disponibilidad = calcularDisponibilidadSoporte(
      String(argumentos['sede']),
      String(argumentos['fecha']),
    );
    return { paraModelo: disponibilidad, estructurado: disponibilidad };
  }
}

import {
  type CanalSoporte,
  DEFINICION_DISPONIBILIDAD_SOPORTE,
  ErrorHerramienta,
  type MotivoSinSoporte,
  SEDES_SOPORTE,
  type SalidaCapacidad,
  type SedeSoporte,
} from '@unihelp/herramientas';
import type { Capacidad } from '../capacidad';

/** Una franja de atencion en hora local de la sede (HH:MM). */
export interface FranjaSoporte {
  readonly inicio: string;
  readonly fin: string;
  readonly canal: CanalSoporte;
}

/** Salida de `consultar_disponibilidad_soporte`, segun su `esquemaSalida`. */
export interface DisponibilidadSoporte {
  readonly sede: SedeSoporte;
  readonly fecha: string;
  readonly dia_semana: DiaSemana;
  readonly disponible: boolean;
  readonly franjas: readonly FranjaSoporte[];
  readonly motivo: MotivoSinSoporte | null;
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

export type DiaSemana = (typeof DIAS_SEMANA)[number];

const presencial = (inicio: string, fin: string): FranjaSoporte => ({
  inicio,
  fin,
  canal: 'presencial',
});

/**
 * Datos sinteticos del sistema (RNF-05): horario semanal por sede. Viven en
 * codigo y no en PostgreSQL porque son un calendario fijo de solo lectura: asi
 * la herramienta es determinista sin sembrar ni restablecer nada entre
 * ejecuciones. Un dia ausente es un dia sin atencion (`fuera_de_horario`).
 */
export const HORARIO_SEMANAL_SOPORTE: Readonly<
  Record<SedeSoporte, Readonly<Partial<Record<DiaSemana, readonly FranjaSoporte[]>>>>
> = {
  central: {
    lunes: [presencial('07:00', '19:00')],
    martes: [presencial('07:00', '19:00')],
    miércoles: [presencial('07:00', '19:00')],
    jueves: [presencial('07:00', '19:00')],
    viernes: [presencial('07:00', '19:00')],
    sábado: [presencial('08:00', '12:00')],
  },
  norte: {
    lunes: [presencial('08:00', '17:00')],
    martes: [presencial('08:00', '17:00')],
    miércoles: [presencial('08:00', '17:00')],
    jueves: [presencial('08:00', '17:00')],
    viernes: [presencial('08:00', '17:00')],
  },
  sur: {
    lunes: [presencial('09:00', '16:00')],
    martes: [presencial('09:00', '16:00')],
    miércoles: [presencial('09:00', '16:00')],
    jueves: [presencial('09:00', '16:00')],
  },
  virtual: Object.fromEntries(
    DIAS_SEMANA.map((dia) => [dia, [{ inicio: '06:00', fin: '22:00', canal: 'chat' } as const]]),
  ),
};

/** Festivos de 2026: cierran las sedes presenciales; la virtual atiende. */
export const FESTIVOS_SOPORTE: readonly string[] = [
  '2026-10-12',
  '2026-11-02',
  '2026-11-16',
  '2026-12-08',
  '2026-12-25',
];

/** Cierres programados por sede y fecha. */
export const CIERRES_PROGRAMADOS_SOPORTE: Readonly<
  Partial<Record<SedeSoporte, readonly string[]>>
> = { norte: ['2026-10-20'] };

/** Sedes que atienden en persona y por eso cierran en festivo. */
const SEDES_PRESENCIALES: readonly SedeSoporte[] = ['central', 'norte', 'sur'];

/**
 * Convierte `AAAA-MM-DD` en fecha de calendario, o `null` si el formato no es
 * ese o la fecha no existe (2026-13-40, 2026-02-30). Se interpreta en UTC para
 * que el dia de la semana no dependa de la zona horaria del proceso.
 */
function fechaDeCalendario(texto: string): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (partes === null) {
    return null;
  }
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const coincide =
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia;
  return coincide ? fecha : null;
}

function esSede(valor: unknown): valor is SedeSoporte {
  return typeof valor === 'string' && (SEDES_SOPORTE as readonly string[]).includes(valor);
}

/**
 * Regla de la herramienta, pura y determinista. El orden de los motivos es
 * deliberado: un cierre programado es el dato mas especifico de la sede, luego
 * el festivo (que aplica a todas las presenciales) y por ultimo el horario
 * semanal; asi un festivo que cae en un dia sin horario (el viernes 25 de
 * diciembre en la sede sur) se informa como festivo.
 *
 * Lanza `ErrorHerramienta('VALIDACION_ENTRADA')` ante una sede o una fecha
 * invalidas: el validador del receptor ya las rechaza por esquema, pero la
 * regla no confia en llegar siempre por esa puerta.
 */
export function consultarDisponibilidadSoporte(
  sede: unknown,
  fecha: unknown,
): DisponibilidadSoporte {
  if (!esSede(sede)) {
    throw new ErrorHerramienta(
      'VALIDACION_ENTRADA',
      `La sede «${String(sede)}» no existe. Sedes válidas: ${SEDES_SOPORTE.join(', ')}.`,
    );
  }
  const calendario = typeof fecha === 'string' ? fechaDeCalendario(fecha) : null;
  if (calendario === null || typeof fecha !== 'string') {
    throw new ErrorHerramienta(
      'VALIDACION_ENTRADA',
      `La fecha «${String(fecha)}» no es válida: debe ser una fecha que exista, con formato AAAA-MM-DD.`,
    );
  }
  const dia_semana = DIAS_SEMANA[calendario.getUTCDay()] as DiaSemana;
  const sinAtencion = (motivo: MotivoSinSoporte): DisponibilidadSoporte => ({
    sede,
    fecha,
    dia_semana,
    disponible: false,
    franjas: [],
    motivo,
  });

  if (CIERRES_PROGRAMADOS_SOPORTE[sede]?.includes(fecha)) {
    return sinAtencion('cierre_programado');
  }
  if (SEDES_PRESENCIALES.includes(sede) && FESTIVOS_SOPORTE.includes(fecha)) {
    return sinAtencion('festivo');
  }
  const franjas = HORARIO_SEMANAL_SOPORTE[sede][dia_semana] ?? [];
  if (franjas.length === 0) {
    return sinAtencion('fuera_de_horario');
  }
  return { sede, fecha, dia_semana, disponible: true, franjas: [...franjas], motivo: null };
}

/**
 * `consultar_disponibilidad_soporte` (HU-43). No consulta ninguna base: su
 * calendario es parte del sistema. No se registra en `CapacidadesModule` (B0 no
 * la ofrece); `mcp-server` la agrega a su registro para B1 (HU-27).
 */
export class ConsultarDisponibilidadSoporteCapacidad implements Capacidad {
  readonly nombre = DEFINICION_DISPONIBILIDAD_SOPORTE.nombre;

  async ejecutar(argumentos: Record<string, unknown>): Promise<SalidaCapacidad> {
    const disponibilidad = consultarDisponibilidadSoporte(argumentos['sede'], argumentos['fecha']);
    return { paraModelo: disponibilidad, estructurado: disponibilidad };
  }
}

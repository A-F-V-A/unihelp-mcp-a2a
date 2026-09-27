import { Injectable } from '@nestjs/common';
import {
  ErrorHerramienta,
  type MotivoSinSoporte,
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

/** Salida de `consultar_disponibilidad_soporte`, segun su `esquemaSalida`. */
export interface DisponibilidadSoporte {
  readonly sede: SedeSoporte;
  readonly fecha: string;
  readonly dia_semana: DiaSemana;
  readonly disponible: boolean;
  readonly franjas: readonly FranjaSoporte[];
  readonly motivo: MotivoSinSoporte | null;
}

/** Indexado como `Date.getUTCDay()`: 0 es domingo. */
const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

type DiaSemana = (typeof DIAS_SEMANA)[number];

const presencial = (inicio: string, fin: string): FranjaSoporte => ({
  inicio,
  fin,
  canal: 'presencial',
});

const LUNES_A_VIERNES: readonly DiaSemana[] = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];

/**
 * Horario semanal de soporte (datos sinteticos de la especificacion, RNF-05). Son
 * parte del sistema y no se consultan a la base: la herramienta es determinista.
 */
export const HORARIO_SOPORTE: Readonly<
  Record<SedeSoporte, Partial<Record<DiaSemana, readonly FranjaSoporte[]>>>
> = {
  central: {
    ...Object.fromEntries(LUNES_A_VIERNES.map((d) => [d, [presencial('07:00', '19:00')]])),
    sábado: [presencial('08:00', '12:00')],
  },
  norte: Object.fromEntries(LUNES_A_VIERNES.map((d) => [d, [presencial('08:00', '17:00')]])),
  sur: Object.fromEntries(
    (['lunes', 'martes', 'miércoles', 'jueves'] as const).map((d) => [
      d,
      [presencial('09:00', '16:00')],
    ]),
  ),
  virtual: Object.fromEntries(
    DIAS_SEMANA.map((d) => [d, [{ inicio: '06:00', fin: '22:00', canal: 'chat' } as const]]),
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

/** Cierres programados por sede. */
export const CIERRES_PROGRAMADOS_SOPORTE: Readonly<
  Partial<Record<SedeSoporte, readonly string[]>>
> = { norte: ['2026-10-20'] };

/**
 * Convierte `AAAA-MM-DD` en fecha UTC y comprueba que exista. El esquema de
 * entrada ya la valida (`format: date`); esta comprobacion protege a quien llame
 * la funcion sin pasar por el validador del receptor.
 */
function fechaUtc(fecha: string): Date {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (partes !== null) {
    const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
    const d = new Date(Date.UTC(anio, mes - 1, dia));
    if (d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia) {
      return d;
    }
  }
  throw new ErrorHerramienta(
    'VALIDACION_ENTRADA',
    `La fecha «${fecha}» no es válida: debe ser una fecha existente con formato AAAA-MM-DD.`,
  );
}

/**
 * Regla de disponibilidad, pura y determinista. El orden importa: un festivo
 * cierra las sedes presenciales aunque ese dia tengan horario, luego el cierre
 * programado de la sede, y por ultimo el horario semanal.
 */
export function consultarDisponibilidadSoporte(sede: string, fecha: string): DisponibilidadSoporte {
  if (!(SEDES_SOPORTE as readonly string[]).includes(sede)) {
    throw new ErrorHerramienta(
      'VALIDACION_ENTRADA',
      `La sede «${sede}» no existe. Sedes válidas: ${SEDES_SOPORTE.join(', ')}.`,
    );
  }
  const sedeValida = sede as SedeSoporte;
  const diaSemana = DIAS_SEMANA[fechaUtc(fecha).getUTCDay()] as DiaSemana;
  const base = { sede: sedeValida, fecha, dia_semana: diaSemana };
  const cerrada = (motivo: MotivoSinSoporte): DisponibilidadSoporte => ({
    ...base,
    disponible: false,
    franjas: [],
    motivo,
  });

  if (sedeValida !== 'virtual' && FESTIVOS_SOPORTE.includes(fecha)) {
    return cerrada('festivo');
  }
  if (CIERRES_PROGRAMADOS_SOPORTE[sedeValida]?.includes(fecha)) {
    return cerrada('cierre_programado');
  }
  const franjas = HORARIO_SOPORTE[sedeValida][diaSemana] ?? [];
  if (franjas.length === 0) {
    return cerrada('fuera_de_horario');
  }
  return { ...base, disponible: true, franjas, motivo: null };
}

/**
 * `consultar_disponibilidad_soporte`, la sexta herramienta (HU-43). Solo lectura
 * y sin contenido recuperado de terceros: la salida no se delimita.
 */
@Injectable()
export class ConsultarDisponibilidadSoporteCapacidad implements Capacidad {
  readonly nombre = NOMBRE_DISPONIBILIDAD_SOPORTE;

  async ejecutar(argumentos: Record<string, unknown>): Promise<SalidaCapacidad> {
    const disponibilidad = consultarDisponibilidadSoporte(
      String(argumentos['sede']),
      String(argumentos['fecha']),
    );
    return { paraModelo: disponibilidad, estructurado: disponibilidad };
  }
}

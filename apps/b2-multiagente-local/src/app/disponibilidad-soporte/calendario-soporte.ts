/**
 * Datos sinteticos del soporte tecnico por sede (RNF-05): horario semanal,
 * festivos y cierres programados. Son parte del sistema, no del modelo: la
 * herramienta responde con ellos y el agente nunca los inventa (HU-43,
 * especificacion de la sexta herramienta; decision 60).
 */

export const SEDES_SOPORTE = ['central', 'norte', 'sur', 'virtual'] as const;

export type SedeSoporte = (typeof SEDES_SOPORTE)[number];

export const CANALES_SOPORTE = ['presencial', 'chat'] as const;

export type CanalSoporte = (typeof CANALES_SOPORTE)[number];

/** Dias en el orden de `Date.getUTCDay()` (0 = domingo), con su ortografia: es texto que ve el modelo. */
export const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

export interface FranjaSoporte {
  readonly inicio: string;
  readonly fin: string;
  readonly canal: CanalSoporte;
}

const presencial = (inicio: string, fin: string): readonly FranjaSoporte[] => [
  { inicio, fin, canal: 'presencial' },
];

const LUNES_A_VIERNES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'] as const;

function repetir(
  dias: readonly DiaSemana[],
  franjas: readonly FranjaSoporte[],
): Partial<Record<DiaSemana, readonly FranjaSoporte[]>> {
  return Object.fromEntries(dias.map((d) => [d, franjas]));
}

/** Horario semanal por sede; un dia ausente es un dia sin atencion (`fuera_de_horario`). */
export const HORARIO_SEMANAL: Readonly<
  Record<SedeSoporte, Partial<Record<DiaSemana, readonly FranjaSoporte[]>>>
> = {
  central: {
    ...repetir(LUNES_A_VIERNES, presencial('07:00', '19:00')),
    sábado: presencial('08:00', '12:00'),
  },
  norte: repetir(LUNES_A_VIERNES, presencial('08:00', '17:00')),
  sur: repetir(['lunes', 'martes', 'miércoles', 'jueves'], presencial('09:00', '16:00')),
  virtual: repetir(DIAS_SEMANA, [{ inicio: '06:00', fin: '22:00', canal: 'chat' }]),
};

/** Festivos de 2026: cierran las sedes presenciales; la sede virtual atiende. */
export const FESTIVOS = ['2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25'];

/** Sedes que atienden en festivo. */
export const SEDES_QUE_ATIENDEN_FESTIVOS: readonly SedeSoporte[] = ['virtual'];

/** Cierres programados por sede (fecha ISO). */
export const CIERRES_PROGRAMADOS: Readonly<Partial<Record<SedeSoporte, readonly string[]>>> = {
  norte: ['2026-10-20'],
};

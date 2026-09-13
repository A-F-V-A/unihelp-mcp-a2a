/** Conversacion de dias anteriores con la que arranca el backend simulado. */
export interface ConversacionPreviaFixture {
  readonly titulo: string;
  /** Hace cuanto empezo, en minutos. */
  readonly haceMinutos: number;
  /** Textos del solicitante, uno por turno; el motor genera las respuestas. */
  readonly mensajes: readonly string[];
}

const HORA = 60;
const DIA = 24 * HORA;

/** Repartidas para ver todos los grupos del historial: hoy, ayer, esta semana y antes. */
export const CONVERSACIONES_PREVIAS: readonly ConversacionPreviaFixture[] = [
  {
    titulo: 'Correo institucional sin envío',
    haceMinutos: 2 * HORA,
    mensajes: [
      'Los correos institucionales no salen desde esta mañana',
      'Me pasa tanto en el celular como en el computador',
    ],
  },
  {
    titulo: 'Cancelar una asignatura',
    haceMinutos: DIA + 3 * HORA,
    mensajes: ['¿Hasta cuándo puedo cancelar una asignatura?'],
  },
  {
    titulo: 'Renovar libros en la biblioteca',
    haceMinutos: 4 * DIA,
    mensajes: ['¿Puedo renovar libros de la biblioteca en línea?'],
  },
  {
    titulo: 'Reembolso por doble cobro',
    haceMinutos: 12 * DIA,
    mensajes: ['Me cobraron dos veces la matrícula y quiero el reembolso'],
  },
];

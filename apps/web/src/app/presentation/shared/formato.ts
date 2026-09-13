import type {
  AreaServicio,
  EstadoIncidente,
  NivelEstadoServicio,
  Prioridad,
  TipoCanalAtencion,
} from '@unihelp/dominio';
import { CATALOGO_AREAS_SERVICIO } from '@unihelp/dominio';
import type { VentanaEstimada } from '../../domain/models/servicio';

const LOCALE = 'es-CO';

const hora = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const fecha = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const diaCorto = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export type FormatoFecha = 'hora' | 'fecha' | 'fecha-hora';

export function formatearFecha(valor: Date, formato: FormatoFecha = 'fecha-hora'): string {
  switch (formato) {
    case 'hora':
      return hora.format(valor);
    case 'fecha':
      return fecha.format(valor);
    case 'fecha-hora':
      return `${fecha.format(valor)}, ${hora.format(valor)}`;
  }
}

const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function nombreDia(valor: Date, ahora: Date): string {
  if (mismoDia(valor, ahora)) {
    return 'hoy';
  }
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  return mismoDia(valor, manana) ? 'mañana' : diaCorto.format(valor);
}

/** Ej.: "hoy, 2:30 p. m. – 4:00 p. m." o "hoy, 10:00 p. m. – mañana, 2:00 a. m.". */
export function formatearVentana(ventana: VentanaEstimada, ahora = new Date()): string {
  const inicio = `${nombreDia(ventana.inicio, ahora)}, ${hora.format(ventana.inicio)}`;
  const fin = mismoDia(ventana.inicio, ventana.fin)
    ? hora.format(ventana.fin)
    : `${nombreDia(ventana.fin, ahora)}, ${hora.format(ventana.fin)}`;
  return `${inicio} – ${fin}`;
}

export const nombreServicio = (servicio: AreaServicio) => CATALOGO_AREAS_SERVICIO[servicio].nombre;

export const ETIQUETA_PRIORIDAD: Readonly<Record<Prioridad, string>> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export const ETIQUETA_ESTADO_INCIDENTE: Readonly<Record<EstadoIncidente, string>> = {
  recibido: 'Recibido',
  'en-triaje': 'En triaje',
  asignado: 'Asignado',
  'en-atencion': 'En atención',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  rechazado: 'Rechazado',
};

export const ETIQUETA_NIVEL_SERVICIO: Readonly<Record<NivelEstadoServicio, string>> = {
  operativo: 'Operativo',
  degradado: 'Degradado',
  interrumpido: 'Interrumpido',
  mantenimiento: 'En mantenimiento',
};

export const ETIQUETA_CANAL: Readonly<Record<TipoCanalAtencion, string>> = {
  web: 'Sitio web',
  correo: 'Correo electrónico',
  telefono: 'Teléfono',
  presencial: 'Atención presencial',
};

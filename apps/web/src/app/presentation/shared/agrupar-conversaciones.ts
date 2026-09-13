import type { ResumenConversacion } from '../../domain/models/conversacion';

export interface GrupoConversaciones {
  readonly etiqueta: string;
  readonly conversaciones: readonly ResumenConversacion[];
}

const DIA_MS = 86_400_000;

const inicioDelDia = (fecha: Date) =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();

const normalizar = (texto: string) =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Agrupa el historial como las apps de chat: Hoy, Ayer, Ultimos 7 dias, Ultimos 30 dias, Anteriores. */
export function agruparPorFecha(
  conversaciones: readonly ResumenConversacion[],
  ahora = new Date(),
): GrupoConversaciones[] {
  const hoy = inicioDelDia(ahora);
  const tramos = [
    { etiqueta: 'Hoy', desde: hoy },
    { etiqueta: 'Ayer', desde: hoy - DIA_MS },
    { etiqueta: 'Últimos 7 días', desde: hoy - 7 * DIA_MS },
    { etiqueta: 'Últimos 30 días', desde: hoy - 30 * DIA_MS },
    { etiqueta: 'Anteriores', desde: Number.NEGATIVE_INFINITY },
  ];
  const grupos = tramos.map((tramo) => ({
    etiqueta: tramo.etiqueta,
    conversaciones: [] as ResumenConversacion[],
  }));

  const ordenadas = [...conversaciones].sort(
    (a, b) => b.actualizadaEn.getTime() - a.actualizadaEn.getTime(),
  );
  for (const conversacion of ordenadas) {
    const indice = tramos.findIndex((tramo) => conversacion.actualizadaEn.getTime() >= tramo.desde);
    grupos[indice].conversaciones.push(conversacion);
  }

  return grupos.filter((grupo) => grupo.conversaciones.length > 0);
}

/** Filtra por titulo sin distinguir mayusculas ni tildes. */
export function filtrarConversaciones(
  conversaciones: readonly ResumenConversacion[],
  consulta: string,
): readonly ResumenConversacion[] {
  const buscada = normalizar(consulta);
  return buscada
    ? conversaciones.filter((conversacion) => normalizar(conversacion.titulo).includes(buscada))
    : conversaciones;
}

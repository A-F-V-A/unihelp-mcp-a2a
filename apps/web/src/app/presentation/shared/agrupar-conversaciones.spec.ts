import type { ResumenConversacion } from '../../domain/models/conversacion';
import { agruparPorFecha, filtrarConversaciones } from './agrupar-conversaciones';

const resumen = (titulo: string, fecha: Date): ResumenConversacion => ({
  id: titulo,
  titulo,
  creadaEn: fecha,
  actualizadaEn: fecha,
  turnos: { usados: 1, maximos: 8 },
});

const AHORA = new Date(2026, 8, 12, 15, 0);

describe('historial de conversaciones', () => {
  it('agrupa por fecha relativa, de lo mas reciente a lo mas antiguo', () => {
    const grupos = agruparPorFecha(
      [
        resumen('antigua', new Date(2026, 6, 1)),
        resumen('hoy', new Date(2026, 8, 12, 9)),
        resumen('ayer', new Date(2026, 8, 11, 23)),
        resumen('semana', new Date(2026, 8, 8)),
      ],
      AHORA,
    );

    expect(grupos.map((g) => [g.etiqueta, g.conversaciones.map((c) => c.id)])).toEqual([
      ['Hoy', ['hoy']],
      ['Ayer', ['ayer']],
      ['Últimos 7 días', ['semana']],
      ['Anteriores', ['antigua']],
    ]);
  });

  it('busca por titulo sin importar tildes ni mayusculas', () => {
    const lista = [resumen('Pago de Matrícula', AHORA), resumen('Correo', AHORA)];
    expect(filtrarConversaciones(lista, 'matricula').map((c) => c.id)).toEqual([
      'Pago de Matrícula',
    ]);
    expect(filtrarConversaciones(lista, '  ')).toHaveLength(2);
  });
});

import type { MensajeAsistente } from '../models/conversacion';
import type { CitaPolitica } from '../models/politica';
import type { PropuestaTicket } from '../models/ticket';
import { propuestaPendiente } from './propuesta.rules';
import { aplicarReglasRespuesta, limiteTurnosAlcanzado, turnosRestantes } from './respuesta.rules';
import { validarSolicitud } from './solicitud.rules';

const cita = (codigo: string): CitaPolitica => ({
  codigo,
  version: '1.0',
  titulo: codigo,
  extracto: '',
  area: 'soporte-tecnico',
});

describe('validarSolicitud (HU-FE-06)', () => {
  it('pide aclaracion, no un error generico, con menos de 10 caracteres utiles', () => {
    const resultado = validarSolicitud('   hola    ');
    expect(resultado.valida).toBe(false);
    if (!resultado.valida) {
      expect(resultado.motivo).toBe('muy-corta');
      expect(resultado.mensaje).toMatch(/cuentas un poco más/);
    }
  });

  it('acepta exactamente 10 y 2000 caracteres, y recorta espacios', () => {
    expect(validarSolicitud('  0123456789  ')).toEqual({ valida: true, texto: '0123456789' });
    expect(validarSolicitud('x'.repeat(2000)).valida).toBe(true);
  });

  it('rechaza mas de 2000 caracteres', () => {
    const resultado = validarSolicitud('x'.repeat(2001));
    expect(resultado.valida === false && resultado.motivo).toBe('muy-larga');
  });
});

describe('aplicarReglasRespuesta (HU-FE-12)', () => {
  it('deja como maximo tres politicas por bloque', () => {
    const mensaje: MensajeAsistente = {
      id: 'm1',
      rol: 'asistente',
      turno: 1,
      clasificacion: { tipo: 'informativa', confianza: 0.9 },
      bloques: [{ tipo: 'politicas', politicas: ['A', 'B', 'C', 'D'].map(cita) }],
      enviadoEn: new Date(),
    };

    const [bloque] = aplicarReglasRespuesta(mensaje).bloques;
    expect(bloque.tipo === 'politicas' && bloque.politicas.map((p) => p.codigo)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });
});

describe('turnos (RNF-04)', () => {
  it('calcula restantes y limite', () => {
    expect(turnosRestantes({ usados: 3, maximos: 8 })).toBe(5);
    expect(limiteTurnosAlcanzado({ usados: 7, maximos: 8 })).toBe(false);
    expect(limiteTurnosAlcanzado({ usados: 8, maximos: 8 })).toBe(true);
  });
});

describe('propuestaPendiente (HU-FE-18)', () => {
  const base = { estado: 'pendiente' } as PropuestaTicket;

  it('solo una propuesta pendiente admite resolucion', () => {
    expect(propuestaPendiente(base)).toBe(true);
    expect(propuestaPendiente({ ...base, estado: 'rechazada' })).toBe(false);
    expect(propuestaPendiente({ ...base, estado: 'confirmada' })).toBe(false);
  });
});

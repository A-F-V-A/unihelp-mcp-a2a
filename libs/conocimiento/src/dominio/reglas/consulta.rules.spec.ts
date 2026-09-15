import { ConsultaInvalidaError } from '../errores';
import { normalizarConsultaPoliticas } from './consulta.rules';

describe('normalizarConsultaPoliticas', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizarConsultaPoliticas({ texto: '  cancelar \n\t asignatura  ' }).texto).toBe(
      'cancelar asignatura',
    );
  });

  it('lleva el texto a NFC para que la misma palabra produzca el mismo resultado (HU-08)', () => {
    const descompuesta = 'matrícula';
    expect(normalizarConsultaPoliticas({ texto: descompuesta }).texto).toBe('matrícula');
  });

  it('exige entre 3 y 300 caracteres', () => {
    expect(() => normalizarConsultaPoliticas({ texto: ' ab ' })).toThrow(ConsultaInvalidaError);
    expect(() => normalizarConsultaPoliticas({ texto: 'a'.repeat(301) })).toThrow(
      ConsultaInvalidaError,
    );
    expect(normalizarConsultaPoliticas({ texto: 'a'.repeat(300) }).texto).toHaveLength(300);
  });

  it('trata filtros vacios como ausentes', () => {
    expect(
      normalizarConsultaPoliticas({ texto: 'correo', servicio: '  ', categoria: undefined }),
    ).toEqual({
      texto: 'correo',
      servicio: null,
      categoria: null,
    });
    expect(normalizarConsultaPoliticas({ texto: 'correo', servicio: ' matricula ' }).servicio).toBe(
      'matricula',
    );
  });
});

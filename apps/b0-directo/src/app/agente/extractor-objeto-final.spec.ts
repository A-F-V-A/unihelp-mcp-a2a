import { ExtractorObjetoFinal } from './extractor-objeto-final';

const objeto = {
  clasificacion: 'compuesta',
  confianza: 0.9,
  politicas_citadas: ['POL-MA-002'],
  diagnostico: { servicio: 'matricula', estado: 'FUERA_DE_SERVICIO', prioridad: 'P2' },
  ticket: { creado: true, id: 'UH-2026-000001' },
  confirmacion: { solicitada: true, otorgada: true },
};

describe('ExtractorObjetoFinal (HU-30)', () => {
  const extractor = new ExtractorObjetoFinal();

  it('separa el texto para la persona del objeto final', () => {
    const r = extractor.separar(
      `Listo, ticket creado.\n\n\`\`\`json\n${JSON.stringify(objeto)}\n\`\`\``,
    );
    expect(r.texto).toBe('Listo, ticket creado.');
    expect(r.objeto).toEqual(objeto);
  });

  it('sin bloque devuelve el texto completo y objeto nulo', () => {
    expect(extractor.separar('Hola')).toEqual({ texto: 'Hola', objeto: null });
  });

  it('un objeto que no cumple el esquema queda nulo, sin romper la respuesta', () => {
    const r = extractor.separar('Texto\n```json\n{"clasificacion":"otra"}\n```');
    expect(r).toEqual({ texto: 'Texto', objeto: null });
  });
});

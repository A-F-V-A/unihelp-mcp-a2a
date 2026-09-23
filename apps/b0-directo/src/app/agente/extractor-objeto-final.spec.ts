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

  it('tolera que el modelo omita las vallas (causa C6 de la corrida)', () => {
    const diagnostico = {
      ...objeto,
      clasificacion: 'diagnostico',
      confianza: 0.98,
      politicas_citadas: [],
    };
    const r = extractor.separar(
      `…estimada de restablecimiento, así que no puedo darte una fecha.\n\n${JSON.stringify(diagnostico)}`,
    );

    expect(r.objeto).toEqual(diagnostico);
    expect(r.texto).toBe('…estimada de restablecimiento, así que no puedo darte una fecha.');
  });

  it('sin vallas y sin objeto valido al final, la respuesta se deja intacta', () => {
    const texto = 'El horario de atención es de 8 a 12 {y también} por la tarde {de 2 a 5}';
    expect(extractor.separar(texto)).toEqual({ texto, objeto: null });
  });

  it('una llave dentro del texto no corta el objeto final', () => {
    const r = extractor.separar(
      `La política usa {llaves} en su ejemplo.\n${JSON.stringify(objeto)}`,
    );
    expect(r.objeto).toEqual(objeto);
    expect(r.texto).toBe('La política usa {llaves} en su ejemplo.');
  });

  it('si el modelo emite el objeto dos veces, no queda ninguna copia en el texto', () => {
    const json = JSON.stringify(objeto);
    const sinVallasYConVallas = extractor.separar(
      `Respuesta.\n\n${json}\n\n\`\`\`json\n${json}\n\`\`\``,
    );
    expect(sinVallasYConVallas).toEqual({ texto: 'Respuesta.', objeto });

    const dosBloques = extractor.separar(
      `Respuesta.\n\`\`\`json\n${json}\n\`\`\`\n\`\`\`json\n${json}\n\`\`\``,
    );
    expect(dosBloques).toEqual({ texto: 'Respuesta.', objeto });
  });
});

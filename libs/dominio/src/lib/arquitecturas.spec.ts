import {
  CATALOGO_ARQUITECTURAS,
  IDENTIFICADORES_ARQUITECTURA,
  esIdentificadorArquitectura,
} from './arquitecturas';

describe('catalogo de arquitecturas', () => {
  it('describe las cuatro arquitecturas del experimento', () => {
    expect(Object.keys(CATALOGO_ARQUITECTURAS)).toEqual([...IDENTIFICADORES_ARQUITECTURA]);
  });

  it('mantiene coherente la clave con el id del descriptor', () => {
    for (const id of IDENTIFICADORES_ARQUITECTURA) {
      expect(CATALOGO_ARQUITECTURAS[id].id).toBe(id);
    }
  });

  it('valida identificadores externos', () => {
    expect(esIdentificadorArquitectura('B2')).toBe(true);
    expect(esIdentificadorArquitectura('B9')).toBe(false);
    expect(esIdentificadorArquitectura(undefined)).toBe(false);
  });
});

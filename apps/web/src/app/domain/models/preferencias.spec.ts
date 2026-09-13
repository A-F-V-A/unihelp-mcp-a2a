import {
  PREFERENCIAS_POR_DEFECTO,
  inicialesDe,
  normalizarPreferencias,
  validarPerfil,
} from './preferencias';

describe('preferencias del solicitante', () => {
  it('normaliza datos guardados incompletos o corruptos', () => {
    expect(normalizarPreferencias(null)).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(normalizarPreferencias('basura')).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(
      normalizarPreferencias({
        tema: 'oscuro',
        tamanoTexto: 'gigante',
        perfil: { rol: 'docente' },
      }),
    ).toEqual({
      perfil: { nombre: '', correo: '', rol: 'docente' },
      tema: 'oscuro',
      tamanoTexto: 'normal',
    });
  });

  it('valida el correo solo si se indica y limpia espacios', () => {
    expect(validarPerfil({ nombre: '  Ana   María ', correo: '', rol: 'estudiante' })).toEqual({
      valido: true,
      perfil: { nombre: 'Ana María', correo: '', rol: 'estudiante' },
    });

    const invalido = validarPerfil({ nombre: 'Ana', correo: 'ana@', rol: 'estudiante' });
    expect(invalido.valido === false && invalido.errores.correo).toMatch(/correo válido/);
  });

  it('calcula las iniciales del avatar', () => {
    expect(inicialesDe('andrés felipe villarraga')).toBe('AV');
    expect(inicialesDe('Ana')).toBe('A');
    expect(inicialesDe('   ')).toBe('');
  });
});

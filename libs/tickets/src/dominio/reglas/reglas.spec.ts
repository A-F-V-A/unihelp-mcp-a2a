import { clasificarAfirmacion } from './afirmacion.rules';
import { SIN_TICKET, prioridadSegunTabla, prioridadesAdmisibles } from './tabla-prioridad.rules';

describe('prioridadSegunTabla (docs/01, F-3)', () => {
  it.each([
    ['interrumpido', 'total', 'critico', 'P1'],
    ['interrumpido', 'total', 'alto', 'P1'],
    ['interrumpido', 'parcial', 'alto', 'P2'],
    ['degradado', 'total', 'critico', 'P2'],
    ['degradado', 'parcial', 'alto', 'P3'],
    ['degradado', 'individual', 'medio', 'P3'],
    ['operativo', 'individual', 'alto', 'P4'],
    ['mantenimiento', 'programado', 'alto', SIN_TICKET],
  ] as const)('%s + %s + %s => %s', (estado, alcance, nivel, esperado) => {
    expect(prioridadSegunTabla(estado, alcance, nivel)).toBe(esperado);
  });

  it('no inventa prioridad en las combinaciones que la tabla no cubre', () => {
    expect(prioridadSegunTabla('interrumpido', 'total', 'medio')).toBeNull();
    expect(prioridadSegunTabla('degradado', 'total', 'alto')).toBeNull();
  });

  it('coincide con las prioridades esperadas por las tareas', () => {
    // T-COM-004: matricula (alto) fuera de servicio parcial.
    expect(
      prioridadesAdmisibles({
        servicioCodigo: 'matricula',
        estado: 'interrumpido',
        alcance: 'parcial',
        nivelServicio: 'alto',
      }),
    ).toContain('P2');
    // T-DIA-009: autenticacion (critico) fuera de servicio total.
    expect(
      prioridadesAdmisibles({
        servicioCodigo: 'autenticacion',
        estado: 'interrumpido',
        alcance: 'total',
        nivelServicio: 'critico',
      }),
    ).toEqual(['P1']);
    // Servicio operativo: solo el caso individual.
    expect(
      prioridadesAdmisibles({
        servicioCodigo: 'aula_virtual',
        estado: 'operativo',
        alcance: null,
        nivelServicio: 'alto',
      }),
    ).toEqual(['P4']);
  });

  it('en mantenimiento no admite ninguna prioridad (HU-12)', () => {
    expect(
      prioridadesAdmisibles({
        servicioCodigo: 'matricula',
        estado: 'mantenimiento',
        alcance: 'programado',
        nivelServicio: 'alto',
      }),
    ).toEqual([]);
  });
});

describe('clasificarAfirmacion (docs/02, 2.4; HU-14, HU-15)', () => {
  it.each(['Sí, por favor créalo.', 'si', 'Confirmo', 'De acuerdo, adelante', 'Dale, hazlo', 'OK'])(
    'acepta «%s»',
    (texto) => expect(clasificarAfirmacion(texto)).toBe('afirmacion'),
  );

  it.each(['No, gracias', 'Mejor no lo crees', 'Cancela eso', 'No quiero ningún ticket'])(
    'reconoce la negativa «%s»',
    (texto) => expect(clasificarAfirmacion(texto)).toBe('negacion'),
  );

  it.each([
    'Si puedes, créalo',
    '¿Y eso qué implica?',
    'Tal vez',
    'Sí, pero primero dime el plazo',
    'Gracias por la información',
  ])('no acepta el texto ambiguo o condicional «%s»', (texto) =>
    expect(clasificarAfirmacion(texto)).toBe('ambigua'),
  );
});

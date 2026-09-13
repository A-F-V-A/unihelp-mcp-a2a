import { TIPOS_CLASIFICACION } from '@unihelp/dominio';
import { ESCENARIOS } from './fixtures/escenarios.fixture';
import { POLITICAS } from './fixtures/politicas.fixture';
import { generarRespuesta, normalizarTexto, resolverEscenario } from './motor-escenarios';

const AHORA = new Date('2026-09-12T15:00:00.000Z');

describe('fixtures de escenarios (HU-FE-02, HU-FE-10)', () => {
  it.each(TIPOS_CLASIFICACION)('hay al menos un escenario con clasificacion %s', (tipo) => {
    expect(ESCENARIOS.some((e) => e.clasificacion.tipo === tipo)).toBe(true);
  });

  it('todas las politicas referenciadas existen', () => {
    const codigos = new Set(POLITICAS.map((p) => p.codigo));
    const referenciadas = ESCENARIOS.flatMap((e) =>
      e.bloques.flatMap((b) => (b.tipo === 'politicas' ? b.codigos : [])),
    );
    expect(referenciadas.filter((codigo) => !codigos.has(codigo))).toEqual([]);
  });

  it('ids de escenario unicos', () => {
    const ids = ESCENARIOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('resolverEscenario', () => {
  it.each([
    ['¿Hasta cuándo puedo cancelar una asignatura?', 'informativa-matricula'],
    ['No puedo entregar la tarea en el aula virtual', 'diagnostico-plataforma'],
    ['No puedo pagar la matrícula por PSE y el plazo vence mañana', 'compuesta-pago-matricula'],
    ['¿Dónde puedo parquear la moto?', 'fuera-alcance-parqueadero'],
    ['Los correos institucionales no salen', 'diagnostico-correo'],
    ['Sí, crea el ticket por favor', 'confirmacion-por-texto'],
  ])('"%s" -> %s', (texto, esperado) => {
    expect(resolverEscenario(texto)?.id).toBe(esperado);
  });

  it('compara palabras completas, sin tildes ni mayusculas', () => {
    expect(normalizarTexto('MATRÍCULA')).toBe('matricula');
    // "red" no debe activarse dentro de "credito".
    expect(resolverEscenario('tengo un credito pendiente')).toBeNull();
  });
});

describe('generarRespuesta', () => {
  it('materializa la ventana estimada relativa a "ahora"', () => {
    const respuesta = generarRespuesta('el aula virtual no carga', null, AHORA);
    const bloque = respuesta.bloques.find((b) => b.tipo === 'estado-servicio');

    expect(bloque?.tipo === 'estado-servicio' && bloque.estado.ventanaEstimada).toEqual({
      inicio: '2026-09-12T14:20:00.000Z',
      fin: '2026-09-12T16:20:00.000Z',
    });
    expect(respuesta.propuesta).not.toBeNull();
  });

  it('mantiene el contexto: sin coincidencias responde como seguimiento del tema previo (HU-04)', () => {
    const respuesta = generarRespuesta('además me pasa desde ayer', 'diagnostico-correo', AHORA);

    expect(respuesta.clasificacion.tipo).toBe('diagnostico');
    expect(respuesta.bloques[0]).toEqual({
      tipo: 'texto',
      texto: expect.stringContaining('el correo institucional'),
    });
    expect(respuesta.propuesta).toBeNull();
  });

  it('sin contexto ni coincidencias pide mas detalle', () => {
    const respuesta = generarRespuesta('necesito ayuda urgente', null, AHORA);
    expect(respuesta.clasificacion).toEqual({ tipo: 'informativa', confianza: 0.41 });
  });

  it('el mantenimiento programado no sugiere ticket (HU-12)', () => {
    const respuesta = generarRespuesta('quiero renovar un libro de la biblioteca', null, AHORA);
    expect(respuesta.bloques.some((b) => b.tipo === 'aviso-mantenimiento')).toBe(true);
    expect(respuesta.propuesta).toBeNull();
  });
});

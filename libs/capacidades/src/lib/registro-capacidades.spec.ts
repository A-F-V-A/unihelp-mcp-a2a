import {
  type ContextoInvocacion,
  DEFINICIONES_HERRAMIENTAS,
  type DefinicionHerramienta,
  EjecutorCapacidad,
  NOMBRES_HERRAMIENTAS,
  type SalidaCapacidad,
  ValidadorArgumentos,
} from '@unihelp/herramientas';
import type { Capacidad } from './capacidad';
import { CapacidadesLocales } from './capacidades-locales';
import type { BuscarPoliticaCapacidad } from './capacidades/buscar-politica.capacidad';
import type { ConfirmarPropuestaCapacidad } from './capacidades/confirmar-propuesta.capacidad';
import type { ConsultarEstadoServicioCapacidad } from './capacidades/consultar-estado-servicio.capacidad';
import type { CrearTicketSimuladoCapacidad } from './capacidades/crear-ticket-simulado.capacidad';
import type { ProponerTicketCapacidad } from './capacidades/proponer-ticket.capacidad';
import { InvocadorCapacidades } from './invocador-capacidades';
import { RegistroCapacidades } from './registro-capacidades';

const contexto: ContextoInvocacion = { traceId: 't1', conversacionId: 'c1', actor: 'prueba' };

/** Capacidad que devuelve sus argumentos y una fecha, para ver como viaja el resultado. */
function capacidadFalsa(nombre: string, salida?: SalidaCapacidad): Capacidad {
  return {
    nombre,
    ejecutar: async (argumentos) =>
      salida ?? {
        paraModelo: { eco: argumentos, cuando: new Date('2026-09-23T10:00:00.000Z') },
        estructurado: { eco: argumentos, cuando: new Date('2026-09-23T10:00:00.000Z') },
      },
  };
}

/** Herramienta que solo existe en las pruebas: la sexta real esta sellada hasta la semana 8. */
export const HERRAMIENTA_DE_PRUEBA: DefinicionHerramienta = {
  nombre: 'herramienta_de_prueba' as DefinicionHerramienta['nombre'],
  titulo: 'Herramienta de prueba',
  descripcion: 'Existe solo para probar el registro aditivo y la notificacion de cambio (HU-27).',
  esquemaEntrada: {
    type: 'object',
    properties: { texto: { type: 'string', minLength: 1 } },
    required: ['texto'],
    additionalProperties: false,
  },
  esquemaSalida: {
    type: 'object',
    properties: { eco: { type: 'object' } },
    required: ['eco'],
  },
  anotaciones: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  tipo: 'lectura',
};

export function montarRegistro() {
  const validador = new ValidadorArgumentos();
  const [buscar, estado, proponer, confirmar, crear] = NOMBRES_HERRAMIENTAS.map((n) =>
    capacidadFalsa(n),
  );
  const registro = new RegistroCapacidades(
    buscar as BuscarPoliticaCapacidad,
    estado as ConsultarEstadoServicioCapacidad,
    proponer as ProponerTicketCapacidad,
    confirmar as ConfirmarPropuestaCapacidad,
    crear as CrearTicketSimuladoCapacidad,
    validador,
  );
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const ejecutor = new EjecutorCapacidad(validador, auditoria, 20);
  const invocador = new InvocadorCapacidades(registro, ejecutor);
  return { registro, invocador, auditoria, puerto: new CapacidadesLocales(registro, invocador) };
}

describe('RegistroCapacidades (HU-25, HU-27)', () => {
  it('arranca con las cinco herramientas del contrato, en el orden del contrato', () => {
    const { registro } = montarRegistro();
    expect(registro.definiciones).toEqual(DEFINICIONES_HERRAMIENTAS);
  });

  it('agrega una herramienta de forma aditiva y avisa a los suscriptores', () => {
    const { registro, invocador } = montarRegistro();
    const avisos = jest.fn();
    registro.alCambiar(avisos);
    registro.agregar(HERRAMIENTA_DE_PRUEBA, capacidadFalsa(HERRAMIENTA_DE_PRUEBA.nombre));

    expect(avisos).toHaveBeenCalledTimes(1);
    expect(registro.definiciones.map((d) => d.nombre)).toEqual([
      ...NOMBRES_HERRAMIENTAS,
      'herramienta_de_prueba',
    ]);
    // Las cinco originales no cambiaron.
    expect(registro.definiciones.slice(0, 5)).toEqual(DEFINICIONES_HERRAMIENTAS);
    // Y la nueva se valida con su propio esquema, como las demas.
    return expect(
      invocador.invocar('herramienta_de_prueba', { texto: '' }, contexto),
    ).resolves.toMatchObject({ ok: false, error: { codigo: 'VALIDACION_ENTRADA' } });
  });

  it('rechaza redefinir una herramienta existente', () => {
    const { registro } = montarRegistro();
    expect(() =>
      registro.agregar(
        DEFINICIONES_HERRAMIENTAS[0] as DefinicionHerramienta,
        capacidadFalsa('buscar_politica'),
      ),
    ).toThrow(/ya esta registrada/);
  });
});

describe('InvocadorCapacidades', () => {
  it('una herramienta inexistente es VALIDACION_ENTRADA y queda auditada', async () => {
    const { invocador, auditoria } = montarRegistro();
    const r = await invocador.invocar('no_existe', {}, contexto);
    expect(r).toMatchObject({ ok: false, error: { codigo: 'VALIDACION_ENTRADA' } });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'herramienta.no_existe', resultado: 'RECHAZADO' }),
    );
  });
});

describe('CapacidadesLocales (puerto en proceso)', () => {
  it('lista las capacidades con nombre, descripcion y esquema de entrada', async () => {
    const { puerto } = montarRegistro();
    const lista = await puerto.listar();
    expect(lista).toHaveLength(5);
    expect(lista[0]).toEqual({
      nombre: 'buscar_politica',
      descripcion: DEFINICIONES_HERRAMIENTAS[0]?.descripcion,
      esquemaEntrada: DEFINICIONES_HERRAMIENTAS[0]?.esquemaEntrada,
    });
  });

  it('mide rtt y dur por separado y devuelve el resultado como si hubiera viajado (D5)', async () => {
    const { puerto } = montarRegistro();
    const r = await puerto.invocar('buscar_politica', { consulta: 'prórroga' }, contexto);
    expect(r.ok).toBe(true);
    expect(r.rttMs).toBeGreaterThanOrEqual(r.durMs);
    if (r.ok) {
      // La fecha llega como ISO 8601, igual que en B1, donde el resultado viene serializado.
      expect(r.salida.estructurado).toEqual({
        eco: { consulta: 'prórroga' },
        cuando: '2026-09-23T10:00:00.000Z',
      });
    }
  });
});

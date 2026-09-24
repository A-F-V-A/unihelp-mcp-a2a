import type {
  BuscarPoliticaUseCase,
  ComponentesDeServicio,
  ConsultarComponentesDeServicioUseCase,
  ResultadoBusquedaPoliticas,
} from '@unihelp/conocimiento';
import { type ContextoInvocacion, definicionDe } from '@unihelp/herramientas';
import type {
  ConfirmarPropuestaUseCase,
  CrearTicketUseCase,
  ProponerTicketUseCase,
  Propuesta,
  Ticket,
} from '@unihelp/tickets';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { BuscarPoliticaCapacidad } from './buscar-politica.capacidad';
import { ConfirmarPropuestaCapacidad } from './confirmar-propuesta.capacidad';
import { ConsultarEstadoServicioCapacidad } from './consultar-estado-servicio.capacidad';
import { CrearTicketSimuladoCapacidad } from './crear-ticket-simulado.capacidad';
import { ProponerTicketCapacidad } from './proponer-ticket.capacidad';

/**
 * Lo que cada capacidad entrega al modelo debe cumplir el `esquemaSalida` que
 * el contrato publica (HU-25). En B1 esto deja de ser una cortesia: el cliente
 * MCP valida `structuredContent` contra `outputSchema` y una salida que no
 * cumpla rompe la llamada solo en B1, lo que contaminaria `B1 - B0`.
 */
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const contexto: ContextoInvocacion = { traceId: 'trace-1', conversacionId: 'c1', actor: 'prueba' };

function validaSalida(nombre: string, salida: unknown): void {
  const esquema = definicionDe(nombre)?.esquemaSalida;
  const validar = ajv.compile(esquema ?? {});
  // Como viaja por la red: fechas en ISO, sin undefined.
  const valido = validar(JSON.parse(JSON.stringify(salida)));
  expect(validar.errors ?? []).toEqual([]);
  expect(valido).toBe(true);
}

const propuesta: Propuesta = {
  id: '3f2c9a4e-1b7d-4c8e-9f0a-2b3c4d5e6f70',
  conversacionId: 'c1',
  traceId: 'trace-1',
  servicio: 'aula_virtual',
  categoria: 'rendimiento',
  prioridad: 'P3',
  resumen: 'No carga el trabajo final',
  descripcion: 'La carga se queda cargando y nunca termina desde hace dos días.',
  solicitante: 'solicitante-c1',
  resumenLegible: 'Servicio: aula_virtual',
  camposFaltantes: [],
  estado: 'pendiente',
  creadaEn: new Date('2026-09-23T10:00:00.000Z'),
  expiraEn: new Date('2026-09-23T10:15:00.000Z'),
  resueltaEn: null,
  ticketNumero: null,
};

const servicio: ComponentesDeServicio = {
  servicio: {
    codigo: 'aula_virtual',
    nombre: 'Aula virtual',
    descripcion: '',
    unidadResponsable: 'OTI',
    area: 'plataforma-virtual',
    nivelServicio: 'alto',
  },
  estado: {
    servicioCodigo: 'aula_virtual',
    estado: 'degradado',
    alcance: 'parcial',
    mensaje: 'Incidencia en la carga de archivos.',
    ventanaEstimada: null,
    incidenteRef: 'INC-2026-0042',
    desde: '2026-09-23T08:00:00.000Z',
  },
  componentes: [
    {
      codigo: 'carga_de_archivos',
      nombre: 'Carga de archivos',
      estado: 'degradado',
      ventanaEstimada: null,
      incidenteRef: 'INC-2026-0042',
    },
  ],
} as unknown as ComponentesDeServicio;

describe('salida de cada capacidad frente a su esquemaSalida (HU-25)', () => {
  it('buscar_politica, con y sin resultados', async () => {
    const encontradas: ResultadoBusquedaPoliticas = {
      tipo: 'encontradas',
      consultaNormalizada: 'prorroga entrega falla tecnica',
      politicas: [
        {
          codigo: 'POL-AV-002',
          version: '1.0',
          titulo: 'Prórroga por falla técnica',
          alcance: 'institucional',
          categorias: ['plazos'],
          servicios: ['aula_virtual'],
          relevancia: 0.42,
          extracto: {
            ordinal: 1,
            inicio: 0,
            fin: 80,
            texto: 'La solicitud se radica en 3 días hábiles.',
          },
        },
      ],
    } as unknown as ResultadoBusquedaPoliticas;
    const sin: ResultadoBusquedaPoliticas = {
      tipo: 'sin-resultados',
      consultaNormalizada: 'xyz',
      motivo: 'sin-coincidencias',
    } as unknown as ResultadoBusquedaPoliticas;
    for (const resultado of [encontradas, sin]) {
      const capacidad = new BuscarPoliticaCapacidad({
        ejecutar: async () => resultado,
      } as unknown as BuscarPoliticaUseCase);
      const salida = await capacidad.ejecutar({ consulta: 'prórroga' }, contexto);
      validaSalida('buscar_politica', salida.paraModelo);
    }
  });

  it('consultar_estado_servicio', async () => {
    const capacidad = new ConsultarEstadoServicioCapacidad({
      ejecutar: async () => servicio,
    } as unknown as ConsultarComponentesDeServicioUseCase);
    const salida = await capacidad.ejecutar({ servicio: 'aula_virtual' }, contexto);
    validaSalida('consultar_estado_servicio', salida.paraModelo);
    expect(salida.paraModelo).toMatchObject({ estado: 'DEGRADADO', alcance: 'parcial' });
  });

  it('proponer_ticket', async () => {
    const capacidad = new ProponerTicketCapacidad(
      { ejecutar: async () => servicio } as unknown as ConsultarComponentesDeServicioUseCase,
      { ejecutar: async () => propuesta } as unknown as ProponerTicketUseCase,
    );
    const salida = await capacidad.ejecutar(
      {
        servicio: 'aula_virtual',
        categoria: 'rendimiento',
        prioridad: 'P3',
        resumen: propuesta.resumen,
        descripcion: propuesta.descripcion,
      },
      contexto,
    );
    validaSalida('proponer_ticket', salida.paraModelo);
  });

  it('confirmar_propuesta, aceptada y rechazada', async () => {
    for (const aceptada of [true, false]) {
      const capacidad = new ConfirmarPropuestaCapacidad({
        porTexto: async () => ({
          aceptada,
          confirmacionToken: aceptada ? 'token-de-24-bytes-en-base64url' : null,
          motivoRechazo: aceptada ? null : 'La respuesta no es una confirmación explícita.',
          propuesta,
        }),
      } as unknown as ConfirmarPropuestaUseCase);
      const salida = await capacidad.ejecutar(
        {
          proposal_id: propuesta.id,
          texto_confirmacion: 'Sí, por favor créalo.',
          actor: 'usuario',
        },
        contexto,
      );
      validaSalida('confirmar_propuesta', salida.paraModelo);
      // El token nunca va a la traza (M5.1 se verifica contra la auditoria).
      expect(JSON.stringify(salida.estructurado)).not.toContain('token-de-24');
    }
  });

  it('crear_ticket_simulado', async () => {
    const ticket: Ticket = {
      numero: 'UH-2026-000001',
      propuestaId: propuesta.id,
      conversacionId: 'c1',
      traceId: 'trace-1',
      servicio: 'aula_virtual',
      categoria: 'rendimiento',
      prioridad: 'P3',
      estado: 'recibido',
      creadoEn: new Date('2026-09-23T10:05:00.000Z'),
    };
    const capacidad = new CrearTicketSimuladoCapacidad({
      ejecutar: async () => ({ ticket, existente: false }),
    } as unknown as CrearTicketUseCase);
    const salida = await capacidad.ejecutar(
      { proposal_id: propuesta.id, confirmacion_token: 'token-de-24-bytes-en-base64url' },
      contexto,
    );
    validaSalida('crear_ticket_simulado', salida.paraModelo);
  });
});

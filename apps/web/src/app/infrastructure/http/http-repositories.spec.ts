import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type {
  ErrorApiDto,
  PoliticaDto,
  PropuestaTicketDto,
  RespuestaMensajeDto,
  TicketDto,
} from '@unihelp/contratos';
import {
  CHAT_REPOSITORY,
  POLITICA_REPOSITORY,
  SERVICIO_REPOSITORY,
  TICKET_REPOSITORY,
} from '../../application/di/tokens';
import { ErrorBackend } from '../../domain/errors/error-backend';
import { CONFIGURACION_APP } from '../../nucleo/configuracion';
import { provideDataLayer } from '../provide-data-layer';

const BACKEND = 'http://backend-b1:3000';

const PROPUESTA: PropuestaTicketDto = {
  id: 'prop-1',
  conversacionId: 'conv-1',
  servicio: 'financiera',
  categoria: 'Pagos en línea',
  prioridad: 'alta',
  resumen: 'No es posible pagar',
  descripcion: 'El solicitante reporta...',
  estado: 'pendiente',
  creadaEn: '2026-09-12T10:00:00.000Z',
  resueltaEn: null,
  ticketNumero: null,
};

/** Deja que `firstValueFrom` se suscriba antes de buscar la peticion. */
const microtareas = () => new Promise((resolver) => setTimeout(resolver, 0));

describe('Repositorios HTTP: contrato con el backend', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIGURACION_APP, useValue: { backendUrl: BACKEND } },
        provideDataLayer(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('POST /api/conversaciones/mensajes y mapea fechas a Date', async () => {
    const promesa = TestBed.inject(CHAT_REPOSITORY).enviarMensaje({
      conversacionId: null,
      texto: 'No puedo pagar la matrícula',
    });

    const peticion = http.expectOne(`${BACKEND}/api/conversaciones/mensajes`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      conversacionId: null,
      texto: 'No puedo pagar la matrícula',
    });

    const dto: RespuestaMensajeDto = {
      conversacionId: 'conv-1',
      mensajeUsuario: {
        id: 'u1',
        rol: 'usuario',
        turno: 1,
        texto: 'No puedo pagar la matrícula',
        enviadoEn: '2026-09-12T10:00:00.000Z',
      },
      respuesta: {
        id: 'a1',
        rol: 'asistente',
        turno: 1,
        clasificacion: { tipo: 'compuesta', confianza: 0.8 },
        bloques: [{ tipo: 'propuesta-ticket', propuesta: PROPUESTA }],
        enviadoEn: '2026-09-12T10:00:01.000Z',
      },
      turnos: { usados: 1, maximos: 8 },
      accionSugerida: null,
      conversacion: {
        id: 'conv-1',
        titulo: 'Pago de matrícula',
        creadaEn: '2026-09-12T10:00:00.000Z',
        actualizadaEn: '2026-09-12T10:00:01.000Z',
        turnos: { usados: 1, maximos: 8 },
      },
    };
    peticion.flush(dto);

    const respuesta = await promesa;
    expect(respuesta.respuesta.enviadoEn).toEqual(new Date('2026-09-12T10:00:01.000Z'));
    const [bloque] = respuesta.respuesta.bloques;
    expect(bloque.tipo === 'propuesta-ticket' && bloque.propuesta.creadaEn).toBeInstanceOf(Date);
  });

  it('confirmar envia confirmacionExplicita: true a la ruta de confirmacion', async () => {
    const promesa = TestBed.inject(TICKET_REPOSITORY).confirmarTicket({
      propuestaId: 'prop 1',
      origen: 'accion-usuario',
    });

    const peticion = http.expectOne(`${BACKEND}/api/tickets/propuestas/prop%201/confirmacion`);
    expect(peticion.request.body).toEqual({ confirmacionExplicita: true });

    const ticket: TicketDto = {
      numero: 'UH-2026-000001',
      propuestaId: 'prop 1',
      conversacionId: 'conv-1',
      servicio: 'financiera',
      categoria: 'Pagos',
      prioridad: 'alta',
      estado: 'recibido',
      creadoEn: '2026-09-12T10:05:00.000Z',
      atencionEstimada: null,
    };
    peticion.flush(ticket);
    expect((await promesa).numero).toBe('UH-2026-000001');
  });

  it('GET de historial, politica (con version) y estado de servicio', async () => {
    void TestBed.inject(CHAT_REPOSITORY)
      .obtenerHistorial('conv-1')
      .catch(() => undefined);
    void TestBed.inject(POLITICA_REPOSITORY)
      .buscarPolitica({ codigo: 'PA-FIN-009', version: '1.2' })
      .catch(() => undefined);
    void TestBed.inject(SERVICIO_REPOSITORY)
      .consultarEstado('biblioteca')
      .catch(() => undefined);
    await microtareas();

    http.expectOne(`${BACKEND}/api/conversaciones/conv-1/mensajes`).flush(null);
    http.expectOne(`${BACKEND}/api/politicas/PA-FIN-009?version=1.2`).flush({} as PoliticaDto);
    http.expectOne(`${BACKEND}/api/servicios/biblioteca/estado`).flush(null);
  });

  it('GET /api/conversaciones y DELETE /api/conversaciones/:id', async () => {
    const chat = TestBed.inject(CHAT_REPOSITORY);

    const lista = chat.listarConversaciones();
    await microtareas();
    http.expectOne(`${BACKEND}/api/conversaciones`).flush([
      {
        id: 'conv-1',
        titulo: 'Pago de matrícula',
        creadaEn: '2026-09-12T10:00:00.000Z',
        actualizadaEn: '2026-09-12T10:05:00.000Z',
        turnos: { usados: 2, maximos: 8 },
      },
    ]);
    expect((await lista)[0].actualizadaEn).toEqual(new Date('2026-09-12T10:05:00.000Z'));

    const eliminar = chat.eliminarConversacion('conv 1');
    await microtareas();
    const peticion = http.expectOne(`${BACKEND}/api/conversaciones/conv%201`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await expect(eliminar).resolves.toBeUndefined();
  });

  it('traduce el cuerpo ErrorApiDto a ErrorBackend', async () => {
    const promesa = TestBed.inject(TICKET_REPOSITORY).rechazarTicket('prop-1');
    await microtareas();

    const cuerpo: ErrorApiDto = { codigo: 'conflicto', mensaje: 'La propuesta ya fue confirmada.' };
    http
      .expectOne(`${BACKEND}/api/tickets/propuestas/prop-1/rechazo`)
      .flush(cuerpo, { status: 409, statusText: 'Conflict' });

    await expect(promesa).rejects.toEqual(expect.objectContaining({ codigo: 'conflicto' }));
  });

  it('sin conexion y status sin cuerpo tipado tambien son ErrorBackend', async () => {
    const tickets = TestBed.inject(TICKET_REPOSITORY);
    const sinConexion = tickets.proponerTicket({ conversacionId: 'conv-1' });
    await microtareas();
    http
      .expectOne(`${BACKEND}/api/tickets/propuestas`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    await expect(sinConexion).rejects.toBeInstanceOf(ErrorBackend);
    await expect(sinConexion).rejects.toEqual(expect.objectContaining({ codigo: 'sin-conexion' }));

    const limite = TestBed.inject(CHAT_REPOSITORY).enviarMensaje({
      conversacionId: 'c',
      texto: 'texto de prueba',
    });
    http
      .expectOne(`${BACKEND}/api/conversaciones/mensajes`)
      .flush('Too Many Requests', { status: 429, statusText: 'Too Many Requests' });
    await expect(limite).rejects.toEqual(expect.objectContaining({ codigo: 'limite-turnos' }));
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CalificacionDto, ErrorApiDto, MuestraRevisionDto } from '@unihelp/contratos';
import { REVISION_HUMANA_REPOSITORY } from '../../application/di/tokens';
import { ErrorBackend } from '../../domain/errors/error-backend';
import { CONFIGURACION_APP } from '../../nucleo/configuracion';
import { provideDataLayer } from '../provide-data-layer';

const CONSOLA = 'http://consola:3030';
const microtareas = () => new Promise((resolver) => setTimeout(resolver, 0));

const MUESTRA: MuestraRevisionDto = {
  version: 'muestra-160-semilla-20261015',
  items: [
    {
      id: 'R-001',
      tarea: 'T-INF-007',
      dialogo: [{ rol: 'usuario', texto: 'Se bloqueó mi cuenta.' }],
      respuestaFinal: 'Se bloquea tras 5 intentos.',
      puntosClave: ['Bloqueo tras 5 intentos.'],
      prohibiciones: [],
      informacionRecuperada: [
        { herramienta: 'buscar_politica', resultado: { tipo: 'encontradas' } },
      ],
    },
  ],
};

describe('HttpRevisionHumanaRepository: contrato con la consola', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CONFIGURACION_APP,
          useValue: { backendUrl: 'http://backend:3000', consolaUrl: CONSOLA },
        },
        provideDataLayer(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee la muestra por el mismo origen, sin /api (el servidor web la reenvia a la consola)', async () => {
    const promesa = TestBed.inject(REVISION_HUMANA_REPOSITORY).muestra();
    await microtareas();
    http.expectOne('/revision/muestra').flush(MUESTRA);
    const muestra = await promesa;
    expect(muestra.items[0].puntosClave).toEqual(['Bloqueo tras 5 intentos.']);
  });

  it('envia la calificacion con las marcas y convierte la fecha', async () => {
    const promesa = TestBed.inject(REVISION_HUMANA_REPOSITORY).calificar(
      'A',
      'Ana',
      'R-001',
      { puntosCubiertos: [1], prohibicionesVioladas: [] },
      'aprobado',
      null,
    );
    await microtareas();
    const peticion = http.expectOne('/revision/calificaciones');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      rol: 'A',
      revisor: 'Ana',
      itemId: 'R-001',
      puntosCubiertos: [1],
      prohibicionesVioladas: [],
      veredicto: 'aprobado',
      comentario: null,
    });
    const respuesta: CalificacionDto = {
      ...peticion.request.body,
      guardadaEn: '2026-09-27T10:00:00.000Z',
    };
    peticion.flush(respuesta);
    expect((await promesa).guardadaEn).toEqual(new Date('2026-09-27T10:00:00.000Z'));
  });

  it('traduce el conflicto de rol tomado a ErrorBackend', async () => {
    const promesa = TestBed.inject(REVISION_HUMANA_REPOSITORY).progreso('B');
    await microtareas();
    const error: ErrorApiDto = {
      codigo: 'conflicto',
      mensaje: 'El rol B ya lo tomó otra persona.',
    };
    http.expectOne('/revision/revisores/B').flush(error, { status: 409, statusText: 'Conflict' });
    await expect(promesa).rejects.toBeInstanceOf(ErrorBackend);
  });
});

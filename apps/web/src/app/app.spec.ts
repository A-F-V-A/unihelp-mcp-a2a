import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RespuestaSalud } from '@unihelp/contratos';
import { App } from './app';
import { CONFIGURACION_APP } from './nucleo/configuracion';

const BACKEND_URL = 'http://backend-de-prueba:3000';

const SALUD_B2: RespuestaSalud = {
  estado: 'ok',
  arquitectura: 'B2',
  servicio: 'b2-multiagente-local',
  rol: 'orquestador',
  protocolo: 'en-proceso',
  descripcion: 'Agentes coordinados en el mismo proceso.',
  consumidoPor: ['B2'],
  dependencias: [],
  version: '0.1.0',
  marcaTiempo: '2026-01-01T00:00:00.000Z',
  tiempoActividadSegundos: 12,
};

describe('App', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIGURACION_APP, useValue: { backendUrl: BACKEND_URL } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta /health del backend configurado, no de una URL fija', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    http.expectOne(`${BACKEND_URL}/health`).flush(SALUD_B2);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('B2');
  });

  it('avisa cuando la arquitectura no esta levantada', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    http
      .expectOne(`${BACKEND_URL}/health`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay respuesta');
  });
});
